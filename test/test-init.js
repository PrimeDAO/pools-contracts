const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');
const { ethers } = require('hardhat');

const initialize = async (accounts) => {
  const setup = {};
  setup.roles = {
    root: accounts[0],
    prime: accounts[1],
    reward_manager: accounts[2],
    authorizer_adaptor: accounts[3],
    operator: accounts[4],
    buyer1: accounts[5],
    buyer2: accounts[6],
    staker: accounts[7],
  };

  return setup;
};

const getTokens = async (setup) => {
  const ERC20Factory = await ethers.getContractFactory('ERC20Mock', setup.roles.root);

  const VeBalFactory = await ethers.getContractFactory('VeBalMock', setup.roles.root);

  const D2DBalFactory = await ethers.getContractFactory('D2DBal', setup.roles.root);

  const DepositTokenFactory = await ethers.getContractFactory('DepositToken', setup.roles.root);

  const B50WBTC50WETH = await ERC20Factory.deploy('Balancer 50 WBTC 50 WETH', 'B-50WBTC-50WETH'); // LP token
  const BAL = await ERC20Factory.deploy('Bal', 'BAL');
  const goldToken = await ERC20Factory.deploy('Gold', 'GLD');
  const D2DBal = await D2DBalFactory.deploy();
  const depositToken = await DepositTokenFactory.deploy(setup.roles.root.address, B50WBTC50WETH.address);
  const PoolContract = await ERC20Factory.deploy('PoolToken', 'BALP');
  const incentiveRewardToken = await ERC20Factory.deploy('IncentiveRewardToken', 'INC');
  const WethBal = await ERC20Factory.deploy('WethBal', 'WethBAL'); // Balancer80BAL20WETH LP token
  const VeBal = await VeBalFactory.deploy(WethBal.address, 'VeBal', 'VeBAL', setup.roles.authorizer_adaptor.address);

  const StashMockFactory = await ethers.getContractFactory('StashMock', setup.roles.root);
  const StashMock = StashMockFactory.deploy();

  const tokens = {
    BAL,
    D2DBal,
    PoolContract,
    WethBal,
    VeBal,
    B50WBTC50WETH,
    StashMock,
    depositToken,
    goldToken,
    incentiveRewardToken,
  };

  setup.tokens = tokens;
  return tokens;
};

const getVoterProxyMock = async (setup) => {
  const VoterProxyMockFactory = await ethers.getContractFactory('VoterProxyMock', setup.roles.root);
  const mintr = setup.tokens.D2DBal;
  const bal = setup.tokens.BAL;
  const veBal = setup.tokens.VeBal;
  const WethBal = setup.tokens.WethBal;

  return await VoterProxyMockFactory.deploy(mintr.address, bal.address, veBal.address, WethBal.address, ZERO_ADDRESS);
};

const getStashMock = async (setup) => {
  const StashMockFactory = await ethers.getContractFactory('StashMock', setup.roles.root);
  return await StashMockFactory.deploy();
};

const getStash = async (setup) => {
  const Stash = await ethers.getContractFactory('ExtraRewardStash', setup.roles.root);
  return await Stash.deploy(setup.tokens.BAL.address);
};

const controller = async (setup, voterProxy, feeDistributor) => {
  const controllerFactory = await ethers.getContractFactory('Controller', setup.roles.root);

  const controller = await controllerFactory.deploy(
    voterProxy.address,
    setup.tokens.BAL.address,
    feeDistributor.address
  );

  await voterProxy.setOperator(controller.address);
  await voterProxy.setDepositor(controller.address);

  return controller;
};

const tokenFactory = async (setup, controller) => {
  const tokenFactory = await ethers.getContractFactory('TokenFactory', setup.roles.root);

  return await tokenFactory.deploy(controller.address);
};

const rewardFactory = async (setup, controller) => {
  const RewardFactory = await ethers.getContractFactory('RewardFactory', setup.roles.root);

  return await RewardFactory.deploy(controller.address, setup.tokens.BAL.address);
};

const baseRewardPool = async (setup, controller, rewardFactory) => {
  const baseRewardPool = await ethers.getContractFactory('BaseRewardPool', setup.roles.root);

  const pid = 0;
  const stakingToken = setup.tokens.D2DBal;
  const rewardToken = setup.tokens.BAL;

  return await baseRewardPool.deploy(
    pid,
    stakingToken.address,
    rewardToken.address,
    controller.address,
    rewardFactory.address
  );
};

const getVirtualBalanceRewardPool = async (setup, baseRewardPool, controller) => {
  const getVirtualBalanceRewardPool = await ethers.getContractFactory('VirtualBalanceRewardPool', setup.roles.root);
  const rewardToken = setup.tokens.goldToken;

  return await getVirtualBalanceRewardPool.deploy(baseRewardPool, rewardToken.address, controller);
};

const balDepositor = async (setup, voterProxy) => {
  const balDepositor = await ethers.getContractFactory('BalDepositor', setup.roles.root);

  return await balDepositor.deploy(
    setup.tokens.WethBal.address,
    setup.tokens.VeBal.address,
    voterProxy.address,
    setup.tokens.D2DBal.address
  );
};

const getMintrMock = async (setup) => {
  const MintrMock = await ethers.getContractFactory('MintrMock');

  const controllerMock = await getControllerMock(setup);

  return await MintrMock.deploy(setup.tokens.BAL.address, controllerMock.address);
};

const stashFactory = async (setup, controller, rewardFactory) => {
  const StashFactory = await ethers.getContractFactory('StashFactory', setup.roles.root);

  return await StashFactory.deploy(controller.address, rewardFactory.address);
};

const getStashFactoryMock = async (setup, controller, rewardFactory) => {
  const StashFactoryMock = await ethers.getContractFactory('StashFactoryMock', setup.roles.root);
  return await StashFactoryMock.deploy(controller.address, rewardFactory.address);
};

const getBaseRewardPool = async (setup) => {
  const BaseRewardPoolFactory = await ethers.getContractFactory('BaseRewardPool', setup.roles.root);

  const controller = await getControllerMock(setup);

  return await BaseRewardPoolFactory.deploy(
    1,
    setup.tokens.D2DBal.address,
    setup.tokens.BAL.address,
    controller.address,
    setup.roles.reward_manager.address
  );
};

const getControllerMock = async (setup) => {
  const ControllerMockFactory = await ethers.getContractFactory('ControllerMock', setup.roles.root);

  return await ControllerMockFactory.deploy();
};

const getExtraRewardMock = async (setup) => {
  const ExtraRewardMockFactory = await ethers.getContractFactory('ExtraRewardMock', setup.roles.root);

  return await ExtraRewardMockFactory.deploy();
};

const gaugeController = async (setup) => {
  const GaugeController = await ethers.getContractFactory('GaugeControllerMock', setup.roles.root);
  return await GaugeController.deploy(setup.tokens.BAL.address, setup.tokens.VeBal.address);
};

const getVoterProxy = async (setup, gaugeController, mintr) => {
  const VoterProxy = await ethers.getContractFactory('VoterProxy', setup.roles.root);

  return await VoterProxy.deploy(
    mintr.address,
    setup.tokens.BAL.address,
    setup.tokens.WethBal.address,
    setup.tokens.VeBal.address,
    gaugeController.address
  );
};

const getGaugeMock = async (setup, lpTokenAddress) => {
  const GaugeMock = await ethers.getContractFactory('GaugeMock', setup.roles.root);
  return await GaugeMock.deploy(lpTokenAddress);
};

const getDistroMock = async (setup) => {
  const DistroMock = await ethers.getContractFactory('DistroMock', setup.roles.root);
  return await DistroMock.deploy();
};

const getExternalContractMock = async (setup) => {
  const DistroMock = await ethers.getContractFactory('ExternalContractMock', setup.roles.root);
  return await DistroMock.deploy();
};

const getRewardFactory = async (setup) => {
  const RewardFactoryFactory = await ethers.getContractFactory('RewardFactory', setup.roles.root);

  return await RewardFactoryFactory.deploy(setup.roles.operator.address, setup.tokens.BAL.address);
};

const getSmartWalletCheckerMock = async (setup) => {
  const SmartWalletCheckerFactory = await ethers.getContractFactory('SmartWalletCheckerMock', setup.roles.root);

  return await SmartWalletCheckerFactory.deploy();
};

const getDelegateRegistry = async (setup) => {
  const DelegateRegistryFactory = await ethers.getContractFactory('DelegateRegistry', setup.roles.root);
  await DelegateRegistryFactory.deploy();

  const bytecode =
    require('../build/artifacts/contracts/test/DelegateRegistry.sol/DelegateRegistry.json').deployedBytecode;

  // replaces bytecode of an address
  await ethers.provider.send('hardhat_setCode', ['0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446', bytecode]);
};

module.exports = {
  initialize,
  getVoterProxy,
  getTokens,
  balDepositor,
  rewardFactory,
  baseRewardPool,
  controller,
  getMintrMock,
  stashFactory,
  getBaseRewardPool,
  getExtraRewardMock,
  tokenFactory,
  getVoterProxyMock,
  getStashFactoryMock,
  gaugeController,
  getControllerMock,
  getRewardFactory,
  getGaugeMock,
  getDistroMock,
  getExternalContractMock,
  getSmartWalletCheckerMock,
  getStashMock,
  getStash,
  getDelegateRegistry,
  getVirtualBalanceRewardPool,
};
