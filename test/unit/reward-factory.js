const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const { expect, assert } = require("chai");
const { deployments, ethers } = require("hardhat");
const { ONE_ADDRESS, TWO_ADDRESS } = require("../helpers/constants.js");
const init = require("../test-init.js");

describe("unit - RewardFactory", function () {

    const setupTests = deployments.createFixture(async () => {
        const signers = await ethers.getSigners();
        const setup = await init.initialize(await ethers.getSigners());
        await init.getTokens(setup);
        const rewardFactoryContract = await init.getRewardFactory(setup);
        return {
            rewardFactoryContract,
            bal: setup.tokens.BAL,
            root: setup.roles.root,
            operator: setup.roles.operator,
            anotherUser: signers.pop(),
        };
    });

    before('>>> setup', async function () {
        const { rewardFactoryContract, operator, bal } = await setupTests();
        assert((await rewardFactoryContract.bal()) == bal.address);
        assert((await rewardFactoryContract.operator()) == operator.address);
    });

    context('access', async function () {
        it('sets access', async function () {
            const { rewardFactoryContract, anotherUser, operator } = await setupTests();

            await expect(rewardFactoryContract.connect(operator).grantRewardStashAccess(anotherUser.address))
                .to.emit(rewardFactoryContract, 'StashAccessGranted')
                .withArgs(anotherUser.address);
        });
    });

    context('Active rewards', async function () {
        it('adds reward', async function () {
            const { rewardFactoryContract, anotherUser, operator } = await setupTests();

            // Give access to somebody
            await expect(rewardFactoryContract.connect(operator).grantRewardStashAccess(anotherUser.address))

            const pid = 1

            await expect(rewardFactoryContract.connect(anotherUser).addActiveReward(ONE_ADDRESS, pid))
                .to.emit(rewardFactoryContract, 'ExtraRewardAdded')
                .withArgs(ONE_ADDRESS, pid);
        });

        it('reverts if user is unauthorized to add reward', async function () {
            const { rewardFactoryContract } = await setupTests();

            await expect(rewardFactoryContract.addActiveReward(ONE_ADDRESS, 1))
                .to.be.revertedWith('Unauthorized()');
        });

        it('reverts if user is unauthorized to remove reward', async function () {
            const { rewardFactoryContract } = await setupTests();

            await expect(rewardFactoryContract.removeActiveReward(ZERO_ADDRESS, 1))
                .to.be.revertedWith('Unauthorized()');
        });

        it('reverts if user is unauthorized to add access', async function () {
            const { rewardFactoryContract, anotherUser } = await setupTests();

            await expect(
                rewardFactoryContract.grantRewardStashAccess(anotherUser.address)
            ).to.be.revertedWith("Unauthorized()");
        });

        it("gets rewards count", async function () {
            const { rewardFactoryContract, anotherUser, operator } = await setupTests();

            // Give access to somebody
            await expect(rewardFactoryContract.connect(operator).grantRewardStashAccess(anotherUser.address))

            const pid = 1

            await expect(rewardFactoryContract.connect(anotherUser).addActiveReward(ONE_ADDRESS, pid))
                .to.emit(rewardFactoryContract, 'ExtraRewardAdded')
                .withArgs(ONE_ADDRESS, pid);

            // should not revert if we try to add the same reward again, it returns early
            expect(await rewardFactoryContract.connect(anotherUser).addActiveReward(ONE_ADDRESS, pid))

            // returns early
            expect(await rewardFactoryContract.connect(anotherUser).addActiveReward(ZERO_ADDRESS, pid))

            expect(await rewardFactoryContract.activeRewardCount(ONE_ADDRESS)).to.equal(1);
        });

        it("removes reward", async function () {
            const { rewardFactoryContract, anotherUser, operator } = await setupTests();

            // Give access to somebody
            await expect(rewardFactoryContract.connect(operator).grantRewardStashAccess(anotherUser.address))

            const pid = 1

            // add extra rewards
            await expect(rewardFactoryContract.connect(anotherUser).addActiveReward(ONE_ADDRESS, pid)).to.emit(rewardFactoryContract, 'ExtraRewardAdded');
            await expect(rewardFactoryContract.connect(anotherUser).addActiveReward(ONE_ADDRESS, pid + 1)).to.emit(rewardFactoryContract, 'ExtraRewardAdded');
            await expect(rewardFactoryContract.connect(anotherUser).addActiveReward(ONE_ADDRESS, pid + 2)).to.emit(rewardFactoryContract, 'ExtraRewardAdded');
            await expect(rewardFactoryContract.connect(anotherUser).addActiveReward(ONE_ADDRESS, pid + 3)).to.emit(rewardFactoryContract, 'ExtraRewardAdded');

            // returns early zero address test
            await expect(
                rewardFactoryContract
                    .connect(anotherUser)
                    .removeActiveReward(ZERO_ADDRESS, pid)
            );
            await expect(
                rewardFactoryContract
                    .connect(anotherUser)
                    .removeActiveReward(ZERO_ADDRESS, pid)
            );

            await expect(rewardFactoryContract.connect(anotherUser).removeActiveReward(ONE_ADDRESS, pid))
                .to.emit(rewardFactoryContract, 'ExtraRewardRemoved')
                .withArgs(ONE_ADDRESS, pid);
        });
    });

    context('Create pools', async function () {
        it('creates bal rewards pool', async function () {
            const { rewardFactoryContract, operator } = await setupTests();

            await expect(rewardFactoryContract.createBalRewards(1, ONE_ADDRESS))
                .to.be.revertedWith('Unauthorized()');

            // if this doesn't revert the pool is created
            await expect(rewardFactoryContract.connect(operator).createBalRewards(1, ONE_ADDRESS)).to.emit(rewardFactoryContract, 'BaseRewardPoolCreated');
        });

        it('creates token rewards pool from operator', async function () {
            const { rewardFactoryContract, operator } = await setupTests();

            await expect(rewardFactoryContract.createTokenRewards(ONE_ADDRESS, TWO_ADDRESS, operator.address))
                .to.be.revertedWith('Unauthorized()');

            // create main pool first
            const tx = await rewardFactoryContract.connect(operator).createBalRewards(1, ONE_ADDRESS);
            const receipt = await tx.wait();
            const mainPoolAddress = receipt.events.pop().args.poolAddress

            await expect(rewardFactoryContract.connect(operator).createTokenRewards(ONE_ADDRESS, mainPoolAddress, operator.address)).to.emit(rewardFactoryContract, 'VirtualBalanceRewardPoolCreated');

            await expect(rewardFactoryContract.connect(operator).createTokenRewards(ONE_ADDRESS, mainPoolAddress, operator.address)).to.emit(rewardFactoryContract, 'VirtualBalanceRewardPoolCreated');
        });

        it('creates token rewards pool from rewardAccess role', async function () {
            const { rewardFactoryContract, operator, anotherUser } = await setupTests();

            // create main pool first
            const tx = await rewardFactoryContract.connect(operator).createBalRewards(1, ONE_ADDRESS);
            const receipt = await tx.wait();
            const mainPoolAddress = receipt.events.pop().args.poolAddress

            // Give access to somebody
            await expect(
                rewardFactoryContract
                    .connect(operator)
                    .grantRewardStashAccess(anotherUser.address)
            );

            await expect(rewardFactoryContract.connect(anotherUser).createTokenRewards(ONE_ADDRESS, mainPoolAddress, operator.address)).to.emit(rewardFactoryContract, 'VirtualBalanceRewardPoolCreated');
        });
    });
});
