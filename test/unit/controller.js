const { expect } = require('chai');
const { deployments, ethers } = require('hardhat');
const { expectRevert } = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');
const { ONE_ADDRESS, ONE_HUNDRED_ETHER } = require('../helpers/constants');
const init = require('../test-init.js');

const defaultProfitFee = 250;
const defaultPlatformFee = 1000;

describe('unit - Controller', function () {
  const setupTests = deployments.createFixture(async () => {
    const setup = await init.initialize(await ethers.getSigners());

    await init.getTokens(setup);
    tokens = setup.tokens;
    staker = setup.roles.staker;

    B50WBTC50WETH = setup.tokens.B50WBTC50WETH;
    gaugeMock = await init.getGaugeMock(setup, B50WBTC50WETH.address);

    feeDistributor = await init.getDistroMock(setup);
    bal = setup.tokens.BAL;
    root = setup.roles.root;
    reward_manager = setup.roles.reward_manager;

    // mock voterProxy
    voterProxy = await init.getVoterProxyMock(setup);
    controller = await init.controller(setup, voterProxy, feeDistributor);

    // Deploy implementation contract
    const implementationAddress = await ethers
      .getContractFactory('StashMock')
      .then((x) => x.deploy())
      .then((x) => x.address);

    proxyFactory = await init.proxyFactory(setup);
    rewardFactory = await init.rewardFactory(setup, controller);

    stashFactory = await init.stashFactory(setup, controller, rewardFactory, proxyFactory);
    // Set implementation contract to mock
    expect(await stashFactory.connect(root).setImplementation(implementationAddress))
      .to.emit(stashFactory, 'ImpelemntationChanged')
      .withArgs(implementationAddress);
    tokenFactory = await init.tokenFactory(setup, controller);

    baseRewardPool = await init.baseRewardPool(setup, controller, rewardFactory);
    stashFactoryMock = await init.getStashFactoryMock(setup, controller, rewardFactory, proxyFactory);

    // set factories and verify
    await controller.setFactories(rewardFactory.address, stashFactory.address, tokenFactory.address);
    expect(await controller.rewardFactory()).to.equal(rewardFactory.address);
    expect(await controller.tokenFactory()).to.equal(tokenFactory.address);
    expect(await controller.stashFactory()).to.equal(stashFactory.address);

    // set rewards contract and verify
    await controller.setRewardContracts(baseRewardPool.address);
    expect(await controller.lockRewards()).to.equal(baseRewardPool.address);

    // set fee info and verify
    await controller.addFeeToken(tokens.BAL.address);
    await controller.addFeeToken(tokens.incentiveRewardToken.address);
    expect(await controller.feeTokensLength()).to.equals(2);
    expect(await controller.feeTokens(0)).to.equal(tokens.BAL.address);
    expect(await controller.feeTokens(1)).to.equal(tokens.incentiveRewardToken.address);
  });

  beforeEach('>>> setup', async function () {
    await setupTests();
  });

  it('» setup', async function () {
    expect(await controller.isShutdown()).to.equals(false);
    expect(await controller.bal()).to.equals(bal.address);
    expect(await controller.staker()).to.equals(voterProxy.address);
    expect(await controller.owner()).to.equals(root.address);
    expect(await controller.poolManager()).to.equals(root.address);
    expect(await controller.feeManager()).to.equals(root.address);
    expect(await controller.feeDistro()).to.equals(feeDistributor.address);
    expect(await controller.treasury()).to.equals(ZERO_ADDRESS);
  });

  context('» setters', async function () {
    it('sets owner', async function () {
      await expect(controller.setOwner(ONE_ADDRESS)).to.emit(controller, 'OwnerChanged').withArgs(ONE_ADDRESS);
      expect(await controller.owner()).to.equals(ONE_ADDRESS);
    });

    it('setOwner reverts if unauthorized', async function () {
      await expectRevert(controller.connect(staker).setOwner(staker.address), 'Unauthorized()');
    });

    it('sets feeManager', async function () {
      await expect(controller.setFeeManager(ONE_ADDRESS))
        .to.emit(controller, 'FeeManagerChanged')
        .withArgs(ONE_ADDRESS);
      expect(await controller.feeManager()).to.equals(ONE_ADDRESS);
    });

    it('sets poolManager', async function () {
      await expect(controller.setPoolManager(ONE_ADDRESS))
        .to.emit(controller, 'PoolManagerChanged')
        .withArgs(ONE_ADDRESS);
      expect(await controller.poolManager()).to.equals(ONE_ADDRESS);
    });

    it('sets voteDelegate', async function () {
      await expect(controller.setVoteDelegate(ONE_ADDRESS))
        .to.emit(controller, 'VoteDelegateChanged')
        .withArgs(ONE_ADDRESS);

      expect(await controller.voteDelegate()).to.equals(ONE_ADDRESS);
    });

    it('addPool reverts on invalid parameters', async function () {
      await expectRevert(controller.addPool(ZERO_ADDRESS, ZERO_ADDRESS), 'InvalidParameters()');
    });
  });

  context('» setFees testing', () => {
    it('sets correct fees', async () => {
      const platformFee = 600;
      const profitFee = 700;
      await expect(controller.setFees(platformFee, profitFee))
        .to.emit(controller, 'FeesChanged')
        .withArgs(platformFee, profitFee);

      expect(await controller.platformFees()).to.equals(platformFee);
      expect(await controller.profitFees()).to.equals(profitFee);
    });

    it('reverts if total fee >MAX_FEES', async () => {
      await expectRevert(controller.connect(root).setFees(2000, 1001), 'InvalidParameters()');
    });

    it('fails if platformFee is too small', async () => {
      await controller.setFees(400, 100);
      expect(await controller.platformFees()).to.equal(defaultPlatformFee);
      expect(await controller.profitFees()).to.equal(defaultProfitFee);
    });

    it('fails if platformFee is too big', async () => {
      await expectRevert(controller.setFees(10000, 100), 'InvalidParameters()');
    });

    it('fails if profitFee is too small', async () => {
      await controller.setFees(500, 10);
      expect(await controller.platformFees()).to.equal(defaultPlatformFee);
      expect(await controller.profitFees()).to.equal(defaultProfitFee);
    });

    it('fails if profitFee is too big', async () => {
      await controller.setFees(500, 2000);
      expect(await controller.platformFees()).to.equal(defaultPlatformFee);
      expect(await controller.profitFees()).to.equal(defaultProfitFee);
    });
  });

  it('earmarkFees succeeds', async () => {
    // not reverting means success
    // we mint reward token to controller (pretend that it got them from voterproxy)
    await tokens.incentiveRewardToken.mint(controller.address, ONE_HUNDRED_ETHER);
    // extra rewards contract should have 0 balance before earmarkFees
    const virtualBalancePoolAddress = await controller.feeTokenToPool(tokens.incentiveRewardToken.address);
    expect(await tokens.incentiveRewardToken.balanceOf(virtualBalancePoolAddress)).to.equals(0);
    await controller.earmarkFees();
    // after earmarkFees controller should transfer tokens to virtualBalancePool
    expect(await tokens.incentiveRewardToken.balanceOf(controller.address)).to.equals(0);
    expect(await tokens.incentiveRewardToken.balanceOf(virtualBalancePoolAddress)).to.equals(ONE_HUNDRED_ETHER);
  });

  context('» _earmarkRewards testing', () => {
    it('Adds pool', async () => {
      await controller.addPool(tokens.B50WBTC50WETH.address, gaugeMock.address);
      expect(await controller.poolLength()).to.equal(1);
      const poolInfo = await controller.poolInfo(0);
      expect(poolInfo.lptoken).to.equal(tokens.B50WBTC50WETH.address);
      expect(poolInfo.gauge).to.equal(gaugeMock.address);
    });

    it('reverts if stash factory returns address(0) for stash', async () => {
      expect(
        await controller
          .connect(root)
          .setFactories(rewardFactory.address, stashFactoryMock.address, tokenFactory.address)
      );
      await expect(
        controller.connect(root).addPool(tokens.B50WBTC50WETH.address, gaugeMock.address)
      ).to.be.revertedWith('InvalidStash()');
    });

    it('Calls earmarkRewards with existing pool number', async () => {
      await controller.addPool(tokens.B50WBTC50WETH.address, gaugeMock.address);
      await controller.setTreasury(ONE_ADDRESS);
      // mint BAL to controller, as if it got reward from VoterProxy
      expect(await tokens.BAL.balanceOf(ONE_ADDRESS)).to.equals(0);
      const balanceBefore = await tokens.BAL.balanceOf(root.address);

      await controller.earmarkRewards(0);

      // 2.5 eth is 2.5% from 100 (100 is being minted as a bal reward in our mock)
      expect(await tokens.BAL.balanceOf(root.address)).to.equals(balanceBefore.add(ethers.utils.parseEther('2.5')));
      // 10 eth is 10% from 100 (100 is being minted as a bal reward in our mock)
      expect(await tokens.BAL.balanceOf(ONE_ADDRESS)).to.equals(ethers.utils.parseEther('10'));
    });

    it('earmarkRewards reverts if pool is closed', async () => {
      await controller.addPool(tokens.B50WBTC50WETH.address, gaugeMock.address);
      const pid = 0;
      await controller.bulkPoolShutdown(pid, pid + 1);
      await expectRevert(controller.earmarkRewards(pid), 'PoolIsClosed()');
      await expectRevert(controller.connect(staker).deposit(pid, ONE_HUNDRED_ETHER, true), 'PoolIsClosed()');
    });
  });

  it('deposits with and without lock and then withdraws all', async function () {
    const pid = 0;
    await controller.addPool(tokens.B50WBTC50WETH.address, gaugeMock.address);

    // mint lp tokens to staker
    await tokens.B50WBTC50WETH.mint(staker.address, ONE_HUNDRED_ETHER.mul(2));
    await tokens.B50WBTC50WETH.connect(staker).approve(controller.address, ONE_HUNDRED_ETHER.mul(2));

    // mint to controller so that we can withdraw
    // normaly voterProxy withdraws from gauge
    await tokens.B50WBTC50WETH.mint(controller.address, ONE_HUNDRED_ETHER);

    await expect(controller.connect(staker).deposit(pid, ONE_HUNDRED_ETHER, true))
      .to.emit(controller, 'Deposited')
      .withArgs(staker.address, pid, ONE_HUNDRED_ETHER, true);

    // deposits leftower amount
    await expect(controller.connect(staker).depositAll(pid, false))
      .to.emit(controller, 'Deposited')
      .withArgs(staker.address, pid, ONE_HUNDRED_ETHER, false);

    // withdraws
    await expect(controller.connect(staker).withdrawAll(pid))
      .to.emit(controller, 'Withdrawn')
      .withArgs(staker.address, pid, ONE_HUNDRED_ETHER);
  });

  it('withdrawsUnlockedWethBal', async function () {
    await controller.withdrawUnlockedWethBal(ONE_HUNDRED_ETHER);
  });

  it('voteGaugeWeight', async function () {
    await controller.voteGaugeWeight([gaugeMock.address], [1000]);
  });

  it('clearFeeTokens', async function () {
    await expect(controller.clearFeeTokens()).to.emit(controller, 'FeeTokensCleared');
    expect(await controller.feeTokensLength()).to.equals(0);
  });

  it('delegateVotingPower', async function () {
    await expect(controller.delegateVotingPower(ONE_ADDRESS))
      .to.emit(voterProxy, 'VotingPowerDelegated')
      .withArgs(ONE_ADDRESS);
  });

  it('clearDelegation', async function () {
    await expect(controller.clearDelegation()).to.emit(voterProxy, 'VotingPowerCleared');
  });

  it('claims rewards', async function () {
    // add pool
    await controller.addPool(tokens.B50WBTC50WETH.address, gaugeMock.address);

    const { stash } = await controller.poolInfo(0);

    const contract = await ethers.getContractFactory('StashMock').then((x) => x.attach(stash));

    await contract.claimRewards();
  });

  it('reverts claimRewards() if unauthorized', async function () {
    await controller.addPool(tokens.B50WBTC50WETH.address, gaugeMock.address);
    await expect(controller.claimRewards(0, ZERO_ADDRESS)).to.be.revertedWith('Unauthorized()');
  });

  it('reverts add pool if system is shut down', async () => {
    await controller.addPool(tokens.B50WBTC50WETH.address, gaugeMock.address);
    await expect(controller.shutdownSystem()).to.emit(controller, 'SystemShutdown');
    // try add another pool
    await expect(controller.addPool(tokens.B50WBTC50WETH.address, gaugeMock.address)).to.be.revertedWith('Shutdown()');
  });

  it('deposit reverts if pool is shut down', async () => {
    const pid = 0;
    await controller.addPool(tokens.B50WBTC50WETH.address, gaugeMock.address);
    await controller.bulkPoolShutdown(pid, pid + 1);
    // repeat call for line coverage to hit 'continue'
    await controller.bulkPoolShutdown(pid, pid + 1);
    await expect(controller.deposit(pid, ONE_ADDRESS, true)).to.be.revertedWith('PoolIsClosed()');
  });

  it('gauge redirect fails', async function () {
    // reverts if gauge address is one address
    await expect(controller.addPool(tokens.B50WBTC50WETH.address, ONE_ADDRESS)).to.be.revertedWith('RedirectFailed()');
  });

  it('deposit reverts if pool is shut down', async () => {
    // withdraw function is tested in another unit test
    // this one is to get coverage to 100%
    const pid = 0;
    await controller.addPool(tokens.B50WBTC50WETH.address, gaugeMock.address);
    const poolInfo = await controller.poolInfo(pid);
    const balRewards = poolInfo.balRewards;
    const baseRewardPoolMock = await getBaseRewardPoolMock(balRewards);

    await expect(controller.withdrawTo(pid, ONE_HUNDRED_ETHER, ZERO_ADDRESS)).to.be.revertedWith('Unauthorized()');

    // testing this properly would require hacking things together, and we already have controller._withdraw covered by another unit test
    // for that reason we don't care that ERC20.burn reverts (in controller._withdraw)
    await expect(
      baseRewardPoolMock.callWithdrawToOnController(controller.address, pid, ONE_HUNDRED_ETHER)
    ).to.be.revertedWith('ERC20: burn amount exceeds balance');
  });
});

const getBaseRewardPoolMock = async (address) => {
  const BaseRewardPoolMockFactory = await ethers.getContractFactory('BaseRewardPoolMock');
  await BaseRewardPoolMockFactory.deploy();

  const bytecode =
    require('../../build/artifacts/contracts/test/BaseRewardPoolMock.sol/BaseRewardPoolMock.json').deployedBytecode;

  await ethers.provider.send('hardhat_setCode', [address, bytecode]);

  return BaseRewardPoolMockFactory.attach(address);
};
