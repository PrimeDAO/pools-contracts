const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants.js');
const { ONE_HUNDRED_ETHER } = require('../helpers/constants.js');
const { expect } = require('chai');
const { ethers } = require('hardhat');
const { getCurrentBlockTimestamp } = require('../helpers/helpers.js');
const { BigNumber, constants } = require('ethers');
const init = require('../test-init.js');

const ZERO = 0;

describe('unit - VirtualBalanceRewardPool', async () => {
  const setupTests = deployments.createFixture(async () => {
    const signers = await ethers.getSigners();
    const setup = await init.initialize(await ethers.getSigners());
    await init.getTokens(setup);
    D2DBal = setup.tokens.D2DBal;
    goldToken = setup.tokens.goldToken;
    root = setup.roles.root;

    controller = await init.getControllerMock(setup);

    baseRewardPool = await init.getBaseRewardPool(setup);

    VirtualBalanceRewardPool = await init.getVirtualBalanceRewardPool(
      setup,
      baseRewardPool.address,
      controller.address
    );
    randomUser = signers.pop();

    // add virtual balance reward pool to BaseRewardPool
    await baseRewardPool.connect(setup.roles.reward_manager).addExtraReward(VirtualBalanceRewardPool.address);
  });

  beforeEach(async function () {
    await setupTests();
  });

  it('returns lastTime reward applicable', async function () {
    const currentTimeInSeconds = await getCurrentBlockTimestamp();
    const periodFinish = await VirtualBalanceRewardPool.periodFinish();
    console.log('get tex', periodFinish);
    const minTime = Math.min(currentTimeInSeconds, periodFinish.toString());

    expect(await VirtualBalanceRewardPool.lastTimeRewardApplicable()).to.equal(minTime);
  });

  it('returns the reward per token', async function () {
    expect(await VirtualBalanceRewardPool.connect(randomUser).lastTimeRewardApplicable()).to.equal(ZERO);
  });
  it('returns the amount earned', async function () {
    expect(await VirtualBalanceRewardPool.connect(randomUser).earned(randomUser.address)).to.equal(ZERO);
  });
  it('allows caller to stake funds', async function () {
    // D2DBal is stake token for BaseRewardPool
    // we mint it to randomuser, so that he can stake it
    await expect(D2DBal.mint(randomUser.address, ONE_HUNDRED_ETHER))
      .to.emit(D2DBal, 'Transfer')
      .withArgs(ZERO_ADDRESS, randomUser.address, ONE_HUNDRED_ETHER);

    const amount = BigNumber.from('50');

    await D2DBal.connect(randomUser).approve(baseRewardPool.address, constants.MaxUint256);

    // randomUser stakes D2DBal in BaseReward pool
    // that automatically stakes the same amount in VirtualBalanceRewardPool
    await expect(baseRewardPool.connect(randomUser).stake(amount))
      .to.emit(baseRewardPool, 'Staked')
      .to.emit(VirtualBalanceRewardPool, 'Staked')
      .withArgs(randomUser.address, amount);

    await goldToken.mint(root.address, ONE_HUNDRED_ETHER.mul(100));
    await goldToken.approve(VirtualBalanceRewardPool.address, constants.MaxUint256);

    // Normally extraRewardStash transfers holds the reward token, and transfers it to corresponding
    // VirtualBalanceRewardPool in extraRewardStash.processStash()
    // in this case we're skipping that, by donating tokens from EOA directly
    await VirtualBalanceRewardPool.donate(ONE_HUNDRED_ETHER);

    // In reality controller.earmarkRewards(pid) would queue new rewards
    // this way we do it manually
    await controller.queueNewRewardsOnVirtualBalanceRewardContract(VirtualBalanceRewardPool.address, ONE_HUNDRED_ETHER);

    // balance before should be 0
    expect(await goldToken.balanceOf(randomUser.address)).to.equals(0);
    await expect(VirtualBalanceRewardPool.connect(randomUser)['getReward()']()).to.emit(
      VirtualBalanceRewardPool,
      'RewardPaid'
    );
    // he should get some goldToken as a reward
    expect(await goldToken.balanceOf(randomUser.address)).to.not.equals(0);
  });

  // it('allows caller to withdraw a specified amount', async function () {
  //   // root is operator for deposit token
  //   const amount = BigNumber.from('200');
  //   await expect(await VirtualBalanceRewardPool.connect(randomUser).withdraw(amount))
  //     .to.emit(VirtualBalanceRewardPool, 'Withdrawn')
  //     .withArgs(randomUser.address, amount);
  // });
  // it('allows caller to claim rewards', async function () {
  //   // root is operator for deposit token
  //   const randomUserRewards = await VirtualBalanceRewardPool.connect(randomUser).rewards(randomUser.address);
  //   await expect(await VirtualBalanceRewardPool.connect(randomUser).getReward(amount))
  //     .to.emit(VirtualBalanceRewardPool, 'RewardPaid')
  //     .withArgs(randomUser.address, randomUserRewards);
  // });
  // it('allows caller to donate rewards', async function () {
  //   // root is operator for deposit token
  //   const amount = BigNumber.from('200');
  //   await D2DBal.connect(randomUser).approve(VirtualBalanceRewardPool.address, constants.MaxUint256);

  //   await VirtualBalanceRewardPool.connect(randomUser).donate(amount);
  //   await expect(await VirtualBalanceRewardPool.connect(randomUser).queuedRewards()).to.equal(amount);
  // });
  // it('allows caller to queueNewRewards rewards', async function () {
  //   // root is operator for deposit token
  //   const amount = BigNumber.from('200');
  //   const currentRewards = await VirtualBalanceRewardPool.connect(randomUser).queuedRewards();
  //   await VirtualBalanceRewardPool.connect(randomUser).queueNewRewards();
  //   const newRewards = currentRewards + amount;
  //   await expect(await VirtualBalanceRewardPool.connect(randomUser).queuedRewards()).to.equal(newRewards);
  // });
});
