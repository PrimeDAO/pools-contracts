const { expect } = require('chai');
const { deployments, ethers } = require('hardhat');
const init = require('../test-init.js');
const { ONE_HUNDRED_ETHER } = require('../helpers/constants');

const addressOne = '0x0000000000000000000000000000000000000001';

describe('unit - ExtraRewardStash', function () {
  const setupTests = deployments.createFixture(async () => {
    const signers = await ethers.getSigners();
    setup = await init.initialize(signers);
    await init.getTokens(setup);

    pid = 0;
    B50WBTC50WETH = setup.tokens.B50WBTC50WETH;
    gauge = await init.getGaugeMock(setup, B50WBTC50WETH.address);
    extraRewardStash = await init.getStash(setup);
    controller = await init.getControllerMock(setup);
    rewardFactory = await init.rewardFactory(setup, controller);
    baseRewardPool = await init.baseRewardPool(setup, controller, rewardFactory);

    // hack things so that it doesn't revert in other smart contracts
    await controller.setBaseRewardPool(baseRewardPool.address);
    await controller.callGrantRewardStashAccess(extraRewardStash.address, rewardFactory.address);

    await extraRewardStash.initialize(pid, controller.address, gauge.address, rewardFactory.address);

    const rewardHookFactory = await ethers.getContractFactory('RewardHookMock', setup.roles.root);
    rewardHook = await rewardHookFactory.deploy();

    const DelegateRegistryFactory = await ethers.getContractFactory('VirtualBalanceRewardPool', setup.roles.root);
    virtualBalanceRewardPool = await DelegateRegistryFactory.deploy(
      baseRewardPool.address,
      setup.tokens.incentiveRewardToken.address,
      controller.address
    );
  });

  beforeEach(async function () {
    await setupTests();
  });

  it('setup', async function () {
    expect(await extraRewardStash.bal()).to.equals(setup.tokens.BAL.address);
    expect(await extraRewardStash.pid()).to.equals(pid);
    expect(await extraRewardStash.operator()).to.equals(controller.address);
    expect(await extraRewardStash.gauge()).to.equals(gauge.address);
    expect(await extraRewardStash.rewardFactory()).to.equals(rewardFactory.address);
  });

  it('reverts if already initialized', async function () {
    await expect(
      extraRewardStash.initialize(pid, controller.address, gauge.address, rewardFactory.address)
    ).to.be.revertedWith('AlreadyInitialized()');
  });

  it('returns tokenCount', async function () {
    expect(await extraRewardStash.tokenCount()).to.equals(0);
  });

  it('reverts if unauthorized', async function () {
    await expect(extraRewardStash.claimRewards()).to.be.revertedWith('Unauthorized()');
  });

  it('clears extra reward', async function () {
    expect(await extraRewardStash.tokenCount()).to.equals(0);
    await extraRewardStash.setExtraReward(setup.tokens.incentiveRewardToken.address);
    expect(await extraRewardStash.tokenCount()).to.equals(1);
    expect(await extraRewardStash.clearExtraRewards()).to.emit(extraRewardStash, 'ExtraRewardsCleared');
    expect(await extraRewardStash.tokenCount()).to.equals(0);
  });

  it('clear extra reward', async function () {
    expect(await extraRewardStash.tokenCount()).to.equals(0);
    await extraRewardStash.setExtraReward(setup.tokens.incentiveRewardToken.address);
    await extraRewardStash.setExtraReward(setup.tokens.B50WBTC50WETH.address);
    expect(await extraRewardStash.tokenCount()).to.equals(2);
    expect(await extraRewardStash.clearExtraReward(0))
      .to.emit(extraRewardStash, 'ExtraRewardCleared')
      .withArgs(setup.tokens.B50WBTC50WETH.address);
    expect(await extraRewardStash.tokenCount()).to.equals(1);
    expect(await extraRewardStash.tokenList(0)).to.equals(setup.tokens.B50WBTC50WETH.address);
  });

  it('sets reward hook', async function () {
    await expect(extraRewardStash.setRewardHook(addressOne))
      .to.emit(extraRewardStash, 'RewardHookSet')
      .withArgs(addressOne);
  });

  it('process stash and claim rewards', async function () {
    await expect(extraRewardStash.setRewardHook(rewardHook.address))
      .to.emit(extraRewardStash, 'RewardHookSet')
      .withArgs(rewardHook.address);
    await setup.tokens.incentiveRewardToken.mint(extraRewardStash.address, ONE_HUNDRED_ETHER);
    await setup.tokens.BAL.mint(extraRewardStash.address, ONE_HUNDRED_ETHER);
    await extraRewardStash.setExtraReward(setup.tokens.incentiveRewardToken.address);
    await extraRewardStash.setExtraReward(setup.tokens.BAL.address);

    await controller.callProcessStash(extraRewardStash.address);
    await controller.callExtraRewardStashClaimRewards(extraRewardStash.address);
  });
});
