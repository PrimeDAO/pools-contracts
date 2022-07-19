const { expect } = require('chai');
const { deployments } = require('hardhat');
const { ONE_HUNDRED_ETHER, ONE_ADDRESS } = require('../helpers/constants');
const { getContract, impersonateAddress, increaseTime } = require('../helpers/helpers');
const {
  getAddresses,
  tags: { deployment },
} = require('../../config');
const { bal } = getAddresses();

const lpTokenWbtcWeth = '0x647c1fd457b95b75d0972ff08fe01d7d7bda05df'; // LP TOKEN Balancer 50 WBTC 50 WETH
const gaugeWbtcWeth = '0xE190E5363C925513228Bf25E4633C8cca4809C9a'; // Gauge for pool 50WBTC 50WETH
const lpToken17WBTC50BAL33USDC = '0xf767f0a3fcf1eafec2180b7de79d0c559d7e7e37'; // LP TOKEN Balancer 17WBTC-50BAL-33USDC
const gauge17WBTC50BAL33USDC = '0x5E7B7B41377Ce4B76d6008F7a91ff9346551c853'; // Gauge for pool 17WBTC-50BAL-33USDC
const lpTokenHolderAddress = '0x79613fb99098089e454ca2439eca452d3740391f'; // LP token Whale that we impersonate
const pid = 0;

// because we are doing this on blockchain fork, our root address on that block number has 3327464671702872 BAL
const startBalanceOfRoot = 3327464671702872; // Root account balance on pinned block number

describe('Kovan clean deployment', function () {
  let voterProxy, d2DBal, balDepositor, controller, rewardFactory, lpTokenContract, lpTokenContractTwo;

  const setupTests = deployments.createFixture(async () => {
    // deploy contract to local fork
    const setup = await deployments.fixture(deployment);

    voterProxy = await getContract('VoterProxy', setup.VoterProxy.address);
    d2DBal = await getContract('D2DBal', setup.D2DBal.address);
    balDepositor = await getContract('BalDepositor', setup.BalDepositor.address);
    controller = await getContract('Controller', setup.Controller.address);
    rewardFactory = await getContract('RewardFactory', setup.RewardFactory.address);
    lpTokenContract = await getContract('ERC20Mock', lpTokenWbtcWeth);
    lpTokenContractTwo = await getContract('ERC20Mock', lpToken17WBTC50BAL33USDC);
  });

  beforeEach(async function () {
    // skip test if we're not on kovan fork
    if (process.env.BLOCKCHAIN_FORK !== 'kovan') {
      this.skip();
    }
    await setupTests();
  });

  it('setup', async function () {
    const { root } = await getNamedAccounts();

    expect(await controller.poolManager()).to.equals(root);
    expect(await controller.voteDelegate()).to.equals(root);
    expect(await voterProxy.owner()).to.equals(root);
    expect(await balDepositor.feeManager()).to.equals(root);
    expect(await d2DBal.name()).to.equals('D2DBal');
  });

  it('adds two pools, deposits LP tokens, earmarks rewards, fee manager, treasury get BAL, staker withdraws', async function () {
    await expect(controller.addPool(lpTokenWbtcWeth, gaugeWbtcWeth)).to.emit(rewardFactory, 'BaseRewardPoolCreated');
    await expect(controller.addPool(lpToken17WBTC50BAL33USDC, gauge17WBTC50BAL33USDC)).to.emit(
      rewardFactory,
      'BaseRewardPoolCreated'
    );

    expect(await controller.poolLength()).to.equals(2);

    // We impersonate LP token WHALE and make him a signer
    const signer = await impersonateAddress(lpTokenHolderAddress);
    await lpTokenContract.connect(signer).approve(controller.address, ONE_HUNDRED_ETHER);

    // We impersonate LP token WHALE and make him a signer
    const signerTwo = await impersonateAddress('0x794846f3291e55e00662d37ef048aa716df9ecbf');
    await lpTokenContractTwo.connect(signerTwo).approve(controller.address, ONE_HUNDRED_ETHER);

    const balTokenContract = await getContract('ERC20Mock', bal);

    // root is deployer + feeManager
    const { root, treasury } = await getNamedAccounts();
    expect(await balTokenContract.balanceOf(root)).to.equals(startBalanceOfRoot);
    expect(await balTokenContract.balanceOf(treasury)).to.equals(0);

    // add treasury
    await expect(controller.setTreasury(treasury)).to.emit(controller, 'TreasuryChanged').withArgs(treasury);

    // deposit from signer
    await expect(controller.connect(signer).deposit(pid, ONE_HUNDRED_ETHER, false)) // do not stake tokens
      .to.emit(controller, 'Deposited')
      .withArgs(signer.address, pid, ONE_HUNDRED_ETHER, false);

    const pidOne = pid + 1;
    // pid + 1 because it is second pool
    await expect(controller.connect(signerTwo).deposit(pidOne, ONE_HUNDRED_ETHER, false)) // do not stake tokens
      .to.emit(controller, 'Deposited')
      .withArgs(signerTwo.address, pidOne, ONE_HUNDRED_ETHER, false);

    await increaseTime(60 * 60 * 24 * 10); // 10 days

    await controller.earmarkRewards_pcp(pid);
    // Fee Manager (root) BAL balance should not be zero anymore
    expect(await balTokenContract.balanceOf(root)).to.be.gt(startBalanceOfRoot);
    // Treasury (root) BAL balance should not be zero anymore
    const treasuryBalanceAfterFirstEarmark = await balTokenContract.balanceOf(treasury);
    expect(treasuryBalanceAfterFirstEarmark).to.not.equals(0);

    // collect rewards from second pool
    await controller.earmarkRewards_pcp(pidOne);

    // Treasury should have bigger balance on secon reward
    expect(await balTokenContract.balanceOf(treasury)).to.be.gt(treasuryBalanceAfterFirstEarmark);

    await expect(controller.connect(signer).withdraw(pid, ONE_HUNDRED_ETHER))
      .to.emit(controller, 'Withdrawn')
      .withArgs(signer.address, pid, ONE_HUNDRED_ETHER);
  });

  it('tries to initial lock wethBal', async function () {
    // can't lock it :(
    await expect(balDepositor.initialLock()).to.be.revertedWith('Smart contract depositors not allowed');
  });

  it('adds pool, deposits LP tokens, shuts down system, withdraws LP tokens to controller', async function () {
    await expect(controller.addPool(lpTokenWbtcWeth, gaugeWbtcWeth)).to.emit(rewardFactory, 'BaseRewardPoolCreated');

    // We impersonate LP token WHALE and make him a signer
    const signer = await impersonateAddress(lpTokenHolderAddress);
    await lpTokenContract.connect(signer).approve(controller.address, ONE_HUNDRED_ETHER);

    const balTokenContract = await getContract('ERC20Mock', bal);

    // root is deployer + feeManager
    // it starts with 0 BAL balance
    const { root, treasury } = await getNamedAccounts();
    expect(await balTokenContract.balanceOf(root)).to.equals(startBalanceOfRoot);
    expect(await balTokenContract.balanceOf(treasury)).to.equals(0);

    // deposit from signer
    await expect(controller.connect(signer).deposit(pid, ONE_HUNDRED_ETHER, false)) // do not stake tokens
      .to.emit(controller, 'Deposited')
      .withArgs(signer.address, pid, ONE_HUNDRED_ETHER, false);

    // System shutdown withdraws LP tokens to controller
    await expect(controller.shutdownSystem()).to.emit(controller, 'SystemShutdown');

    // try to deposit when system is shut down
    await expect(controller.connect(signer).deposit(pid, ONE_HUNDRED_ETHER, false)) // do not stake tokens
      .to.be.revertedWith('Shutdown()');
  });

  it('adds pool, deposits, shuts down pool, reverts', async function () {
    await expect(controller.addPool(lpTokenWbtcWeth, gaugeWbtcWeth)).to.emit(rewardFactory, 'BaseRewardPoolCreated');

    // We impersonate LP token WHALE and make him a signer
    const signer = await impersonateAddress(lpTokenHolderAddress);
    await lpTokenContract.connect(signer).approve(controller.address, ONE_HUNDRED_ETHER);

    await expect(controller.connect(signer).deposit(pid, ONE_HUNDRED_ETHER, false)) // do not stake tokens
      .to.emit(controller, 'Deposited')
      .withArgs(signer.address, pid, ONE_HUNDRED_ETHER, false);

    await expect(controller.bulkPoolShutdown(pid, pid + 1))
      .to.emit(controller, 'PoolShutDown')
      .withArgs(pid);

    // Controller should get the LP tokens
    expect(await lpTokenContract.balanceOf(controller.address)).to.equals(ONE_HUNDRED_ETHER);

    // try to deposit
    await expect(controller.connect(signer).deposit(pid, ONE_HUNDRED_ETHER, false)) // do not stake tokens
      .to.be.revertedWith('PoolIsClosed()');
  });

  it('delegates voting power, and then clears delegate', async function () {
    await expect(controller.delegateVotingPower(ONE_ADDRESS))
      .to.emit(voterProxy, 'VotingPowerDelegated')
      .withArgs(ONE_ADDRESS);

    await expect(controller.clearDelegation()).to.emit(voterProxy, 'VotingPowerCleared');
  });
});
