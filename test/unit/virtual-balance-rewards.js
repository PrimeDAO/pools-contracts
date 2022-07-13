const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants.js');
const { ONE_HUNDRED_ETHER } = require('../helpers/constants.js');
const { expect } = require('chai');
const { ethers } = require('hardhat');
const { getCurrentBlockTimestamp } = require('../helpers/helpers.js');
const { BigNumber, constants } = require('ethers');
const init = require('../test-init.js');

const ZERO = 0;

describe('unit - VirtualBalanceRewardPool', async () => {
  let randomUser;
  let VirtualBalanceRewardPool;
  let D2DBal;
  const setupTests = deployments.createFixture(async () => {
    const signers = await ethers.getSigners();
    const setup = await init.initialize(await ethers.getSigners());
    await init.getTokens(setup);

    D2DBal = setup.tokens.D2DBal;
    // const { D2DBal } = await init.getTokens(setup);
    console.log(D2DBal.address);

    //const operatorAddress = setup.baseRewardPool.operator();

    // setup.controller = await init.getControllerMock(setup);
    controller = await init.getControllerMock(setup);
    rewardFactory = await init.rewardFactory(setup, controller);

    // setup.baseRewardPool = await init.baseRewardPool(setup, setup.controller, setup.rewardFactory);

    baseRewardPool = await init.baseRewardPool(setup, controller, rewardFactory);

    VirtualBalanceRewardPool = await init.getVirtualBalanceRewardPool(
      setup,
      baseRewardPool.address,
      controller.address
    );
    randomUser = signers.pop();

    // console.log('hello world', VirtualBalanceRewardPool);
    // return {
    //   VirtualBalanceRewardPool,
    //   root: setup.roles.root,
    //   randomUser: signers.pop(),
    // };
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
    await expect(await VirtualBalanceRewardPool.connect(randomUser).lastTimeRewardApplicable()).to.equal(ZERO);
  });
  it('returns the amount earned', async function () {
    await expect(await VirtualBalanceRewardPool.connect(randomUser).earned(randomUser.address)).to.equal(ZERO);
  });
  it('allows caller to stake funds', async function () {
    await expect(D2DBal.mint(randomUser.address, ONE_HUNDRED_ETHER))
      .to.emit(D2DBal, 'Transfer')
      .withArgs(ZERO_ADDRESS, randomUser.address, ONE_HUNDRED_ETHER);
    const amount = BigNumber.from('2');
    // let tx = await randomUser.getBalance();
    // console.log('this is bal', tx.toString());
    //await D2DBal.approve(baseRewardPool.address, amount);
    await D2DBal.connect(randomUser).approve(baseRewardPool.address, constants.MaxUint256);
    let firstStake = await baseRewardPool.connect(randomUser).stake(amount);
    await expect(firstStake).to.emit(baseRewardPool, 'Staked').withArgs(randomUser.address, amount);
    await expect(await VirtualBalanceRewardPool.connect(randomUser).stake(randomUser.address, amount))
      .to.emit(VirtualBalanceRewardPool, 'Staked')
      .withArgs(randomUser.address, amount);
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
