const { expect } = require('chai');
const { deployments, ethers } = require('hardhat');
const init = require('../test-init.js');

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

    await extraRewardStash.initialize(pid, controller.address, gauge.address, rewardFactory.address);
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
});
