const { expect, assert } = require('chai');
const { deployments, ethers } = require('hardhat');
const { ONE_ADDRESS, TWO_ADDRESS } = require('../helpers/constants.js');
const init = require('../test-init.js');

describe('unit - RewardFactory', function () {
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

    it('reverts if user is unauthorized to add stash access', async function () {
      const { rewardFactoryContract, anotherUser } = await setupTests();

      await expect(rewardFactoryContract.grantRewardStashAccess(anotherUser.address)).to.be.revertedWith(
        'Unauthorized()'
      );
    });
  });

  context('Create pools', async function () {
    it('creates bal rewards pool', async function () {
      const { rewardFactoryContract, operator } = await setupTests();

      await expect(rewardFactoryContract.createBalRewards(1, ONE_ADDRESS)).to.be.revertedWith('Unauthorized()');

      // if this doesn't revert the pool is created
      await expect(rewardFactoryContract.connect(operator).createBalRewards(1, ONE_ADDRESS)).to.emit(
        rewardFactoryContract,
        'BaseRewardPoolCreated'
      );
    });

    it('creates token rewards pool from operator', async function () {
      const { rewardFactoryContract, operator } = await setupTests();

      await expect(
        rewardFactoryContract.createTokenRewards(ONE_ADDRESS, TWO_ADDRESS, operator.address)
      ).to.be.revertedWith('Unauthorized()');

      // create main pool first
      const tx = await rewardFactoryContract.connect(operator).createBalRewards(1, ONE_ADDRESS);
      const receipt = await tx.wait();
      const mainPoolAddress = receipt.events.pop().args.poolAddress;

      await expect(
        rewardFactoryContract.connect(operator).createTokenRewards(ONE_ADDRESS, mainPoolAddress, operator.address)
      ).to.emit(rewardFactoryContract, 'VirtualBalanceRewardPoolCreated');

      await expect(
        rewardFactoryContract.connect(operator).createTokenRewards(ONE_ADDRESS, mainPoolAddress, operator.address)
      ).to.emit(rewardFactoryContract, 'VirtualBalanceRewardPoolCreated');
    });

    it('creates token rewards pool from rewardAccess role', async function () {
      const { rewardFactoryContract, operator, anotherUser } = await setupTests();

      // create main pool first
      const tx = await rewardFactoryContract.connect(operator).createBalRewards(1, ONE_ADDRESS);
      const receipt = await tx.wait();
      const mainPoolAddress = receipt.events.pop().args.poolAddress;

      // Give access to somebody
      await expect(rewardFactoryContract.connect(operator).grantRewardStashAccess(anotherUser.address));

      await expect(
        rewardFactoryContract.connect(anotherUser).createTokenRewards(ONE_ADDRESS, mainPoolAddress, operator.address)
      ).to.emit(rewardFactoryContract, 'VirtualBalanceRewardPoolCreated');
    });
  });
});
