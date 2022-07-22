const { expect } = require('chai');
const { constants } = require('ethers');
const { deployments, ethers } = require('hardhat');
const { getAddresses, PRIME_MULTISIG } = require('../../config');
const { ONE_ADDRESS } = require('../helpers/constants');
const { getContract, impersonateAddress, increaseTime } = require('../helpers/helpers');
const addresses = getAddresses();

const multisig = addresses[PRIME_MULTISIG];
const staBAL3 = '0x06df3b2bbb68adc8b0e302443692037ed9f91b42'; // lp token
const staBAL3Whale = '0x4086e3e1e99a563989a9390facff553a4f29b6ee'; // lp token whale

describe('Mainnet integration tests [ @skip-on-coverage ]', async () => {
  const setupTests = deployments.createFixture(async () => {
    const pools = [
      {
        name: 'Balancer staBAL3 Gauge Deposit',
        lpToken: '0x06df3b2bbb68adc8b0e302443692037ed9f91b42',
        gauge: '0x34f33CDaED8ba0E1CEECE80e5f4a73bcf234cfac',
      },
      {
        name: 'B-50SNX-50WETH',
        lpToken: '0x072f14b85add63488ddad88f855fda4a99d6ac9b',
        gauge: '0x605eA53472A496c3d483869Fe8F355c12E861e19',
      },
    ];

    const accounts = await getNamedAccounts();
    // deploy contract to local fork
    const setup = await deployments.fixture();

    voterProxy = await getContract('VoterProxy', setup.VoterProxy.address);
    d2DBal = await getContract('D2DBal', setup.D2DBal.address);
    balDepositor = await getContract('BalDepositor', setup.BalDepositor.address);
    controller = await getContract('Controller', setup.Controller.address);
    rewardFactory = await getContract('RewardFactory', setup.RewardFactory.address);
    baseRewardPool = await getContract('BaseRewardPool', setup.BaseRewardPool.address);

    root = accounts.root;
    treasury = accounts.treasury;

    bal = await getContract('ERC20Mock', addresses.bal);
    wethBal = await getContract('ERC20Mock', addresses.wethBal);
    staBAL3LpToken = await getContract('ERC20Mock', staBAL3);

    // wethBal whale
    wethBalWhaleSigner = await impersonateAddress('0xc9cea7a3984cefd7a8d2a0405999cb62e8d206dc');

    // Whitelist VoterProxy so that we can lock wethBal
    const balancerMultisig = '0x10a19e7ee7d7f8a52822f6817de8ea18204f2e4f';

    // send eth to balancer multisig, because we need it when we impersonate it to send tx
    const ethWhale = await impersonateAddress('0x9bf4001d307dfd62b26a2f1307ee0c0307632d59');
    await ethWhale.sendTransaction({ to: balancerMultisig, value: ethers.utils.parseEther('1') });

    // impersonate and allow voterProxy to be whitelisted
    const walletChecker = await getContract('SmartWalletCheckerMock', '0x7869296Efd0a76872fEE62A058C8fBca5c1c826C');
    const balancerMultiSig = await impersonateAddress('0x10a19e7ee7d7f8a52822f6817de8ea18204f2e4f');
    await expect(walletChecker.connect(balancerMultiSig).allowlistAddress(voterProxy.address))
      .to.emit(walletChecker, 'ContractAddressAdded')
      .withArgs(voterProxy.address);

    // send some amount for initial lock
    await wethBal.connect(wethBalWhaleSigner).transfer(voterProxy.address, ethers.utils.parseEther('100'));

    // do the initial lock
    await balDepositor.initialLock();

    for (const pool of pools) {
      await controller.addPool(pool.lpToken, pool.gauge);
      console.log('Controller addPool: ', pool.name);
    }
  });

  beforeEach(async () => {
    if (!process.env.ARCHIVE_NODE_URL) {
      this.skip();
    }
    await setupTests();
  });

  it('setup', async () => {
    expect(await controller.poolManager()).to.equals(multisig);
    expect(await controller.voteDelegate()).to.equals(multisig);
    expect(await voterProxy.owner()).to.equals(multisig);
    expect(await balDepositor.feeManager()).to.equals(multisig);
    expect(await d2DBal.name()).to.equals('D2DBal');
    expect(await d2DBal.owner()).to.equals(balDepositor.address);
  });

  it('deposits staBAL3LpToken, earmarks rewards, treasury and multisig should get rewards', async function () {
    const pid = 0; // staBAL3LpToken is pid = 0
    // see order of pools in config.js (mainnet)

    const signer = await impersonateAddress(staBAL3Whale);
    const amount = ethers.utils.parseEther('10000');
    await staBAL3LpToken.connect(signer).approve(controller.address, amount);

    expect(await bal.balanceOf(multisig)).to.equals(0);
    expect(await bal.balanceOf(treasury)).to.equals(0);

    // add treasury
    await expect(controller.setTreasury(treasury)).to.emit(controller, 'TreasuryChanged').withArgs(treasury);

    // deposit from signer
    await expect(controller.connect(signer).deposit(pid, amount, true)) // do not stake tokens
      .to.emit(controller, 'Deposited')
      .withArgs(signer.address, pid, amount, true);

    // initialize balRewards contract
    const poolInfo = await controller.poolInfo(0);
    const balRewards = await getContract('BaseRewardPool', poolInfo.balRewards);

    await increaseTime(60 * 60 * 24 * 50); // 50 days

    // collect rewards for this pool
    await controller.earmarkRewards(pid);

    // Fee Manager (root) BAL balance should not be zero anymore
    expect(await bal.balanceOf(multisig)).to.be.gt(0);
    // Treasury should get something as well
    expect(await bal.balanceOf(treasury)).to.be.gt(0);

    // withdraw all and unwrap should withdraw invested amount
    await expect(balRewards.connect(signer).withdrawAllAndUnwrap(true))
      .to.emit(controller, 'Withdrawn')
      .withArgs(signer.address, pid, amount);
  });

  it('locks wethBal, deposits, redeems after wethBal by burning D2DBal after 1 year', async function () {
    await wethBal.connect(wethBalWhaleSigner).approve(balDepositor.address, constants.MaxUint256);

    const balance = await wethBal.balanceOf(wethBalWhaleSigner.address);

    // stake from whale
    await expect(balDepositor.connect(wethBalWhaleSigner).depositAll(true, baseRewardPool.address))
      .to.emit(baseRewardPool, 'Staked')
      .withArgs(wethBalWhaleSigner.address, balance);

    await increaseTime(60 * 60 * 24 * 366); // 366 days

    // signer to get his D2DBal
    await expect(baseRewardPool.connect(wethBalWhaleSigner).withdrawAll(true))
      .to.emit(baseRewardPool, 'Withdrawn')
      .withArgs(wethBalWhaleSigner.address, balance);

    // trigger from root (multisig)
    await controller.withdrawUnlockedWethBal();

    // assert that he has 0 wethBal
    expect(await wethBal.balanceOf(wethBalWhaleSigner.address)).to.equals(0);

    // burn balance of D2DBal get wethBal back 1:1 ratio
    await expect(controller.connect(wethBalWhaleSigner).redeemWethBal())
      .to.emit(wethBal, 'Transfer')
      .withArgs(controller.address, wethBalWhaleSigner.address, balance);

    // assert that he got wethBal back
    expect(await wethBal.balanceOf(wethBalWhaleSigner.address)).to.equals(balance);
  });

  it('votes for gauge weight 100%', async function () {
    // vote for two gauges 50% each
    const gaugeToVoteForOne = '0x34f33CDaED8ba0E1CEECE80e5f4a73bcf234cfac';
    const gaugeToVoteForTwo = '0x605eA53472A496c3d483869Fe8F355c12E861e19';
    const gaugeController = await getContract('GaugeControllerMock', '0xC128468b7Ce63eA702C1f104D55A2566b13D3ABD');

    await expect(controller.voteGaugeWeight([gaugeToVoteForOne, gaugeToVoteForTwo], [500, 500])).to.emit(
      gaugeController,
      'VoteForGauge'
    );
  });

  it('delegates, and clears voting power', async function () {
    await expect(controller.delegateVotingPower(ONE_ADDRESS))
      .to.emit(voterProxy, 'VotingPowerDelegated')
      .withArgs(ONE_ADDRESS);

    await expect(controller.clearDelegation()).to.emit(voterProxy, 'VotingPowerCleared');
  });
});
