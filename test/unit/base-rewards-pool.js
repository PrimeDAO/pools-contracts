const { expect } = require("chai");
const { BigNumber, constants } = require("ethers");
const { deployments, ethers } = require("hardhat");
const init = require("../test-init.js");
const { ONE_ADDRESS } = require('../helpers/constants')

describe("BaseRewardPool", function () {

    const setupTests = deployments.createFixture(async () => {
        const signers = await ethers.getSigners();

        const setup = await init.initialize(await ethers.getSigners());
        const { BAL, Balancer80BAL20WETH } = await init.getTokens(setup);
        
        const baseRewardPool = await init.getBaseRewardPool(setup);

        const operatorFactory = await ethers.getContractFactory('ControllerMock')
        const operatorAddress = await baseRewardPool.operator()
        const operator = operatorFactory.attach(operatorAddress)
        await operator.setRewardContracts(baseRewardPool.address)

        // mint BAL to pool so that the pool can give out rewards 
        await BAL.mint(baseRewardPool.address, ethers.utils.parseEther('10000'))

        return {
            baseRewardPool,
            operator,
            rewardToken: BAL,
            stakeToken: Balancer80BAL20WETH, 
            extraRewardMock: await init.getExtraRewardMock(),
            root: setup.roles.root,
            rewardManager: setup.roles.reward_manager,
            anotherUser: signers.pop(),
        }
    });

    before('setup', async function() {
        const { baseRewardPool, rewardToken, stakeToken, rewardManager } = await setupTests();

        expect(await baseRewardPool.DURATION()).to.equal(604800) // 7 days
        expect(await baseRewardPool.rewardToken()).to.equal(rewardToken.address)
        expect(await baseRewardPool.stakingToken()).to.equal(stakeToken.address)
        expect(await baseRewardPool.rewardManager()).to.equal(rewardManager.address) 
        expect(await baseRewardPool.periodFinish()).to.equal(0)
        expect(await baseRewardPool.rewardRate()).to.equal(0)
        expect(await baseRewardPool.lastUpdateTime()).to.equal(0)
        expect(await baseRewardPool.rewardPerTokenStored()).to.equal(0)
        expect(await baseRewardPool.queuedRewards()).to.equal(0)
        expect(await baseRewardPool.currentRewards()).to.equal(0)
        expect(await baseRewardPool.historicalRewards()).to.equal(0)
        expect(await baseRewardPool.NEW_REWARD_RATIO()).to.equal(830)
        expect(await baseRewardPool.extraRewardsLength()).to.equal(0)
        expect(await baseRewardPool.extraRewardsLength()).to.equal(0)
        expect(await baseRewardPool.lastTimeRewardApplicable()).to.be.equal(BigNumber.from(0))
        expect(await baseRewardPool.rewardPerToken()).to.be.equal(BigNumber.from(0))
    })

    context("Extra rewards", async function() {
        it("reverts if not called by reward manager", async function () {
            const { baseRewardPool } = await setupTests();

            const signers = await ethers.getSigners()
    
            await expect(baseRewardPool.connect(signers[10]).addExtraReward(ONE_ADDRESS)).to.be.revertedWith('Unauthorized()')
        });

        it("adds rewards", async function () {
            const { baseRewardPool, rewardManager } = await setupTests();
    
            await baseRewardPool.connect(rewardManager).addExtraReward(ONE_ADDRESS)
            expect(await baseRewardPool.extraRewardsLength()).to.equal(1)
        });
    });

    context('Stake', async function() {
        it("reverts on invalid amount able to stake", async function() {
            const { baseRewardPool } = await setupTests();
    
            await expect(baseRewardPool.stake(0)).to.be.revertedWith('InvalidAmount()')
        });

        it("stakes 10000 stake tokens", async function() {
            const { baseRewardPool, stakeToken, root } = await setupTests();
    
            const amount = BigNumber.from('10000')

            await stakeAmount(baseRewardPool, stakeToken, amount, root)
        });
        
        it("stakes all stake tokens", async function() {
            const { baseRewardPool, stakeToken, root } = await setupTests();
            
            const amount = await stakeToken.balanceOf(root.address)
            
            await stakeToken.connect(root).approve(baseRewardPool.address, constants.MaxUint256);
            
            await expect(baseRewardPool.connect(root).stakeAll())
            .to.emit(baseRewardPool, 'Staked').withArgs(root.address, amount)
        });
        
        it("reverts on invalid stake amount for somebody else", async function() {
            const { baseRewardPool, root, anotherUser } = await setupTests();

            await expect(baseRewardPool.connect(root).stakeFor(anotherUser.address, 0))
                .to.be.revertedWith('InvalidAmount()')
        });

        it("stakes 10000 stake tokens for somebody else", async function() {
            const { baseRewardPool, stakeToken, root, anotherUser } = await setupTests();
    
            const amount = BigNumber.from('10000')

            await stakeToken.connect(root).approve(baseRewardPool.address, constants.MaxUint256);
    
            await expect(baseRewardPool.connect(root).stakeFor(anotherUser.address, amount))
                .to.emit(baseRewardPool, 'Staked').withArgs(anotherUser.address, amount)
        });
    });

    context('Unstake', async function() {
        it("reverts on invalid unstake amount", async function() {
            const { baseRewardPool } = await setupTests();
    
            await expect(baseRewardPool.withdraw(0, true)).to.be.revertedWith('InvalidAmount()')
        });

        it("unstakes 10000 stake tokens", async function() {
            const { baseRewardPool, stakeToken, root } = await setupTests();

            const amount = BigNumber.from('10000')

            await stakeAmount(baseRewardPool, stakeToken, amount, root)

            await expect(baseRewardPool.connect(root).withdraw(amount, true))
                .to.emit(baseRewardPool, 'Withdrawn').withArgs(root.address, amount)
        });

        it("unstakes all stake tokens", async function() {
            const { baseRewardPool, stakeToken, root } = await setupTests();

            const amount = await stakeToken.balanceOf(root.address)

            await stakeAmount(baseRewardPool, stakeToken, amount, root)

            await expect(baseRewardPool.connect(root).withdrawAll(true))
                .to.emit(baseRewardPool, 'Withdrawn').withArgs(root.address, amount)
        });

        it("withdraws and unwraps", async function() {
            // NOTE: stakeAmount is not being returned to staker
            // because controller is a mock and does nothing

            const { baseRewardPool, stakeToken, root } = await setupTests();

            const amount = BigNumber.from('10000')

            await stakeAmount(baseRewardPool, stakeToken, amount, root)

            await expect(baseRewardPool.connect(root).withdrawAndUnwrap(0, true))
                .to.be.revertedWith('InvalidAmount()')

            await expect(baseRewardPool.connect(root).withdrawAndUnwrap(amount, true))
                .to.emit(baseRewardPool, 'Withdrawn').withArgs(root.address, amount)
        });

        it("withdraws all and unwraps", async function() {
            // NOTE: stakeAmount is not being returned to staker
            // because controller is a mock and does nothing

            const { baseRewardPool, stakeToken, root, extraRewardMock, rewardManager } = await setupTests();

            // add extra rewards mock
            await baseRewardPool.connect(rewardManager).addExtraReward(extraRewardMock.address)
            expect(await baseRewardPool.extraRewardsLength()).to.equal(1)

            const amount = await stakeToken.balanceOf(root.address)

            await stakeAmount(baseRewardPool, stakeToken, amount, root)

            await expect(baseRewardPool.connect(root).withdrawAllAndUnwrap(true))
                .to.emit(baseRewardPool, 'Withdrawn').withArgs(root.address, amount)
        });
    });

    it("changes ratio by queueing new rewards multiple times", async function() {
        const { baseRewardPool, operator } = await setupTests();

        // 604800 is the minimum number of reward amount
        // that amount gets devided by reward rate, which is 604800 (7 days)
        // in this case we have 1 reward token per second

        // now + 40 seconds(so that it doesnt throw an error because current tiemstamp > next timestamp)
        const nextBlockTimestamp = Math.floor(Date.now() / 1000) + 40
        await network.provider.send("evm_setNextBlockTimestamp", [nextBlockTimestamp])

        const rewardAmount = BigNumber.from('604800')
        await expect(operator.queueNewRewards(rewardAmount))
            .to.emit(baseRewardPool, 'RewardAdded').withArgs(rewardAmount)

        // 10 seconds difference between blocks
        const blockPlusOneTimestamp = Math.floor(Date.now() / 1000) + 50
        await network.provider.send("evm_setNextBlockTimestamp", [blockPlusOneTimestamp])

        // we add reward 2 times, but there is 10 sec diff between blocks
        // rewardAmount * 2 - 10 = 1209590
        await expect(operator.queueNewRewards(rewardAmount))
            .to.emit(baseRewardPool, 'RewardAdded').withArgs(BigNumber.from('1209590'))
    });

    it("changes ratio by queueing new rewards multiple times queuedRation > NEW_REWARD_RATIO", async function() {
        const { baseRewardPool, operator } = await setupTests();
        
        // now + 40 seconds(so that it doesnt throw an error because current tiemstamp > next timestamp)
        const nextBlockTimestamp = Math.floor(Date.now() / 1000) + 40
        await network.provider.send("evm_setNextBlockTimestamp", [nextBlockTimestamp])
    
        const rewardAmount = BigNumber.from('60480000').mul(100)
        await expect(operator.queueNewRewards(rewardAmount))
            .to.emit(baseRewardPool, 'RewardAdded').withArgs(rewardAmount)
    
        // change timestamp to 10 min + 10 seconds difference between last reward queue
        const blockPlusOneTimestamp = Math.floor(Date.now() / 1000) + 50 + 6000
        await network.provider.send("evm_setNextBlockTimestamp", [blockPlusOneTimestamp])
            
        const newRewardAmount = BigNumber.from('60480000')
        await operator.queueNewRewards(newRewardAmount)
    
        expect(await baseRewardPool.queuedRewards()).to.equal(BigNumber.from('60480000'))
    });

    it("queues and gets the reward", async function() {
        const { baseRewardPool, stakeToken, root, operator, extraRewardMock, rewardManager } = await setupTests();

        // add extra rewards mock
        await baseRewardPool.connect(rewardManager).addExtraReward(extraRewardMock.address)
        expect(await baseRewardPool.extraRewardsLength()).to.equal(1)

        const amountStaked = await stakeToken.balanceOf(root.address)

        // 604800 is the minimum number of reward amount
        // that amount gets devided by reward rate, which is 604800 (7 days)
        // in this case we have 1 reward token per second
        const rewardAmount = BigNumber.from('604800').mul(100)
        await expect(operator.queueNewRewards(rewardAmount))
            .to.emit(baseRewardPool, 'RewardAdded').withArgs(rewardAmount)
        
        await stakeAmount(baseRewardPool, stakeToken, amountStaked, root)

        // now + 1 day
        const nextBlockTimestamp = Math.floor(Date.now() / 1000) + 1440
        await network.provider.send("evm_setNextBlockTimestamp", [nextBlockTimestamp])
        
        // Formula is stakedAmount * reward rate
        // In our case reward rate is 1, because we queueNewRewards few lines above to make it that way
        // Amount staked * reward rate / 1e18
        const expectedResult = amountStaked.mul(1).div(ethers.utils.parseEther('1'))

        await expect(baseRewardPool.connect(root)['getReward()']())
            .to.emit(baseRewardPool, 'RewardPaid').withArgs(root.address, expectedResult)
    })

    it("donates reward token", async function() {
        const { baseRewardPool, rewardToken, root } = await setupTests();

        await rewardToken.connect(root).approve(baseRewardPool.address, constants.MaxUint256);
        const donateAmount = await rewardToken.balanceOf(root.address)

        await expect(baseRewardPool.connect(root).donate(donateAmount)).to.emit(rewardToken, 'Transfer')
        expect(await rewardToken.balanceOf(root.address)).to.equal(0)
    });

    it("returns correct result for unsafeInc", async function() {
        const { baseRewardPool } = await setupTests();

        await expect(baseRewardPool.unsafeIncExternal(1))
            .to.emit(baseRewardPool, 'Result').withArgs(2)
    });
});

// Helper function to stake amount of stake tokens to baseRewardPool from signer
const stakeAmount = async (baseRewardPool, stakeToken, amount, signer) => {
    await stakeToken.connect(signer).approve(baseRewardPool.address, constants.MaxUint256);
    
    await expect(baseRewardPool.connect(signer).stake(amount))
    .to.emit(baseRewardPool, 'Staked').withArgs(signer.address, amount)
}