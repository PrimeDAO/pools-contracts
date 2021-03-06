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

    await baseRewardPool.connect(setup.roles.reward_manager).addExtraReward(VirtualBalanceRewardPool.address);
  });

  beforeEach(async function () {
    await setupTests();
  });

  it('returns lastTime reward applicable', async function () {
    const currentTimeInSeconds = await getCurrentBlockTimestamp();
    const periodFinish = await VirtualBalanceRewardPool.periodFinish();
    const minTime = Math.min(currentTimeInSeconds, periodFinish.toString());

    expect(await VirtualBalanceRewardPool.lastTimeRewardApplicable()).to.equal(minTime);
  });

  it('returns the reward per token', async function () {
    expect(await VirtualBalanceRewardPool.connect(randomUser).lastTimeRewardApplicable()).to.equal(ZERO);
  });

  it('returns the amount earned', async function () {
    expect(await VirtualBalanceRewardPool.connect(randomUser).earned(randomUser.address)).to.equal(ZERO);
  });

  it('fails if the user is not authorized to call stake funds', async function () {
    await expect(
      VirtualBalanceRewardPool.connect(randomUser).stake(randomUser.address, ONE_HUNDRED_ETHER)
    ).to.be.revertedWith('Unauthorized()');
  });

  it('allows caller to stake funds', async function () {
    await expect(D2DBal.mint(randomUser.address, ONE_HUNDRED_ETHER))
      .to.emit(D2DBal, 'Transfer')
      .withArgs(ZERO_ADDRESS, randomUser.address, ONE_HUNDRED_ETHER);

    const amount = BigNumber.from('50');

    await D2DBal.connect(randomUser).approve(baseRewardPool.address, constants.MaxUint256);

    await expect(baseRewardPool.connect(randomUser).stake(amount))
      .to.emit(baseRewardPool, 'Staked')
      .to.emit(VirtualBalanceRewardPool, 'Staked')
      .withArgs(randomUser.address, amount);

    await goldToken.mint(root.address, ONE_HUNDRED_ETHER.mul(100));
    await goldToken.approve(VirtualBalanceRewardPool.address, constants.MaxUint256);
    await VirtualBalanceRewardPool.donate(ONE_HUNDRED_ETHER);

    await controller.queueNewRewardsOnVirtualBalanceRewardContract(VirtualBalanceRewardPool.address, ONE_HUNDRED_ETHER);

    expect(await goldToken.balanceOf(randomUser.address)).to.equals(0);
    await expect(VirtualBalanceRewardPool.connect(randomUser)['getReward()']()).to.emit(
      VirtualBalanceRewardPool,
      'RewardPaid'
    );

    expect(await goldToken.balanceOf(randomUser.address)).to.not.equals(0);
  });

  it('allows caller to withdraw a specified amount', async function () {
    const withdrawAmount = BigNumber.from('5');
    const claim = false;
    const unwrap = false;

    await expect(D2DBal.mint(randomUser.address, ONE_HUNDRED_ETHER))
      .to.emit(D2DBal, 'Transfer')
      .withArgs(ZERO_ADDRESS, randomUser.address, ONE_HUNDRED_ETHER);

    const amount = BigNumber.from('50');

    await D2DBal.connect(randomUser).approve(baseRewardPool.address, constants.MaxUint256);

    await expect(baseRewardPool.connect(randomUser).stake(amount))
      .to.emit(baseRewardPool, 'Staked')
      .to.emit(VirtualBalanceRewardPool, 'Staked')
      .withArgs(randomUser.address, amount);

    await expect(baseRewardPool.connect(randomUser).withdraw(withdrawAmount, claim, unwrap))
      .to.emit(baseRewardPool, 'Withdrawn')
      .to.emit(VirtualBalanceRewardPool, 'Withdrawn')
      .withArgs(randomUser.address, withdrawAmount);
  });

  it('allows caller to claim rewards', async function () {
    await expect(D2DBal.mint(randomUser.address, ONE_HUNDRED_ETHER))
      .to.emit(D2DBal, 'Transfer')
      .withArgs(ZERO_ADDRESS, randomUser.address, ONE_HUNDRED_ETHER);

    const amount = BigNumber.from('50');

    await D2DBal.connect(randomUser).approve(baseRewardPool.address, constants.MaxUint256);

    await expect(baseRewardPool.connect(randomUser).stake(amount))
      .to.emit(baseRewardPool, 'Staked')
      .to.emit(VirtualBalanceRewardPool, 'Staked')
      .withArgs(randomUser.address, amount);

    await goldToken.mint(root.address, ONE_HUNDRED_ETHER.mul(100));
    await goldToken.approve(VirtualBalanceRewardPool.address, constants.MaxUint256);
    await VirtualBalanceRewardPool.donate(ONE_HUNDRED_ETHER);
    await controller.queueNewRewardsOnVirtualBalanceRewardContract(VirtualBalanceRewardPool.address, ONE_HUNDRED_ETHER);

    expect(await goldToken.balanceOf(randomUser.address)).to.equals(0);
    await expect(VirtualBalanceRewardPool.connect(randomUser)['getReward()']()).to.emit(
      VirtualBalanceRewardPool,
      'RewardPaid'
    );
    expect(await goldToken.balanceOf(randomUser.address)).to.not.equals(0);
  });

  it('allows caller to donate rewards', async function () {
    await goldToken.mint(root.address, ONE_HUNDRED_ETHER.mul(100));
    await goldToken.approve(VirtualBalanceRewardPool.address, constants.MaxUint256);
    await VirtualBalanceRewardPool.donate(ONE_HUNDRED_ETHER);
    expect(await VirtualBalanceRewardPool.queuedRewards()).to.not.equals(0);
  });

  it('fails if the user is not authorized to call queueNewRewards', async function () {
    await expect(VirtualBalanceRewardPool.queueNewRewards(ONE_HUNDRED_ETHER)).to.be.revertedWith('Unauthorized()');
  });

  it('tests queue rewards when block.timestamp is less than periodFinish', async function () {
    await expect(D2DBal.mint(randomUser.address, ONE_HUNDRED_ETHER))
      .to.emit(D2DBal, 'Transfer')
      .withArgs(ZERO_ADDRESS, randomUser.address, ONE_HUNDRED_ETHER);

    const amount = BigNumber.from('50');

    await D2DBal.connect(randomUser).approve(baseRewardPool.address, constants.MaxUint256);

    await expect(baseRewardPool.connect(randomUser).stake(amount))
      .to.emit(baseRewardPool, 'Staked')
      .to.emit(VirtualBalanceRewardPool, 'Staked')
      .withArgs(randomUser.address, amount);

    await goldToken.mint(root.address, ONE_HUNDRED_ETHER.mul(100));
    await goldToken.approve(VirtualBalanceRewardPool.address, constants.MaxUint256);
    await VirtualBalanceRewardPool.donate(ONE_HUNDRED_ETHER);
    await VirtualBalanceRewardPool.donate(ONE_HUNDRED_ETHER);
    await controller.queueNewRewardsOnVirtualBalanceRewardContract(VirtualBalanceRewardPool.address, ONE_HUNDRED_ETHER);
    await controller.queueNewRewardsOnVirtualBalanceRewardContract(VirtualBalanceRewardPool.address, ONE_HUNDRED_ETHER);

    expect(await goldToken.balanceOf(randomUser.address)).to.equals(0);
    await expect(VirtualBalanceRewardPool.connect(randomUser)['getReward()']()).to.emit(
      VirtualBalanceRewardPool,
      'RewardPaid'
    );
    expect(await goldToken.balanceOf(randomUser.address)).to.not.equals(0);
  });

  it('tests queue rewards when queued ration is greater than new reward ratio', async function () {
    const FOURTY_SECONDS = 40;
    const FIFTY_SECONDS = 50;
    const ONE_WEEK = 604800;

    const currentTimeInSeconds = await getCurrentBlockTimestamp();

    const rewardAmount = BigNumber.from(ONE_WEEK.toString()).mul(10000);
    const newRewardAmount = BigNumber.from(ONE_WEEK.toString()).mul(100);
    await goldToken.mint(root.address, rewardAmount);
    await goldToken.mint(root.address, newRewardAmount);
    await goldToken.approve(VirtualBalanceRewardPool.address, constants.MaxUint256);

    await VirtualBalanceRewardPool.donate(rewardAmount);

    const nextBlockTimestamp = currentTimeInSeconds + FOURTY_SECONDS;
    await network.provider.send('evm_setNextBlockTimestamp', [nextBlockTimestamp]);

    await controller.queueNewRewardsOnVirtualBalanceRewardContract(VirtualBalanceRewardPool.address, rewardAmount);

    const blockPlusOneTimestamp = currentTimeInSeconds + FIFTY_SECONDS + 6000;
    await network.provider.send('evm_setNextBlockTimestamp', [blockPlusOneTimestamp]);

    await VirtualBalanceRewardPool.donate(newRewardAmount);

    await controller.queueNewRewardsOnVirtualBalanceRewardContract(VirtualBalanceRewardPool.address, newRewardAmount);
  });
});
