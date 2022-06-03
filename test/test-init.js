const { ethers } = require('hardhat')

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
  };

  return setup;
};

const getTokens = async (setup) => {
  const ERC20Factory = await ethers.getContractFactory(
    "ERC20Mock",
    setup.roles.root
  );

  const VeBalFactory = await ethers.getContractFactory(
    "VeBalMock",
    setup.roles.root
  );

  const B50WBTC50WETH = await ERC20Factory.deploy("Balancer 50 WBTC 50 WETH", "B-50WBTC-50WETH"); // LP token
  const BAL = await ERC20Factory.deploy("Bal", "BAL");
  const D2DBal = await ERC20Factory.deploy("D2DBal", "D2DBAL");
  const PoolContract = await ERC20Factory.deploy("PoolToken", "BALP");
  const WethBal = await ERC20Factory.deploy("WethBal", "WethBAL"); // Balancer80BAL20WETH LP token
  const VeBal = await VeBalFactory.deploy(WethBal.address, "VeBal", "VeBAL", setup.roles.authorizer_adaptor.address);

  const tokens = {
    BAL,
    D2DBal,
    PoolContract,
    WethBal,
    VeBal,
    B50WBTC50WETH
  };

  setup.tokens = tokens;
  return tokens;
};

const balDepositor = async (setup, voterProxy) => {
  const balDepositor = await ethers.getContractFactory(
    "BalDepositor",
    setup.roles.root
  );

  return await balDepositor.deploy(
    setup.tokens.WethBal.address,
    setup.tokens.VeBal.address,
    voterProxy.address,
    setup.tokens.D2DBal.address
  );
};

const controller = async (setup) => {
    const controller = await ethers.getContractFactory(
      "Controller",
      setup.roles.root
    );
    const bal = setup.tokens.BAL;
    const wethBal = setup.tokens.WethBal;
    const staker = setup.VoterProxy;
    const registry = setup.RegistryMock;
    const voteOwnership = staker;
    const voteParameter = staker;
    const distributionAddressId = 1;
    return await controller.deploy(
        staker.address, 
        setup.roles.root.address, 
        wethBal.address, 
        bal.address, 
        registry.address,
        voteOwnership.address,
        voteParameter.address,
        distributionAddressId);
};

const rewardFactory = async (setup) => {
  const RewardFactoryFactory = await ethers.getContractFactory(
    "RewardFactory",
    setup.roles.root
  );

  const bal = setup.tokens.BAL;
  const operator = setup.roles.operator;

  return await RewardFactoryFactory.deploy(bal.address, operator.address);
};

const proxyFactory = async (setup) => {
  const ProxyFactory = await ethers.getContractFactory(
    "ProxyFactory",
    setup.roles.root
  );

  return await ProxyFactory.deploy();
};

const getMintrMock = async (setup) => {
  const MintrMock = await ethers.getContractFactory("MintrMock");

  const controllerMock = await getControllerMock(setup)

  return await MintrMock.deploy(setup.tokens.BAL.address, controllerMock.address);
}

const stashFactory = async (setup) => {
  const StashFactory = await ethers.getContractFactory(
    "StashFactory",
    setup.roles.root
  );

  const operator = await getControllerMock(setup);
  const reward = await rewardFactory(setup);
  const fac = await proxyFactory(setup);

  return await StashFactory.deploy(
    operator.address,
    reward.address,
    fac.address
  );
};

const getBaseRewardPool = async (setup) => {
  const BaseRewardPoolFactory = await ethers.getContractFactory(
    "BaseRewardPoolInTest",
    setup.roles.root
  );

  const controller = await getControllerMock(setup);

  return await BaseRewardPoolFactory.deploy(
    1,
    setup.tokens.D2DBal.address,
    setup.tokens.BAL.address,
    controller.address,
    setup.roles.reward_manager.address
  );
};

const getVoterProxy = async (setup, gaugeControllerMock, mintr) => {
  const VoterProxy = await ethers.getContractFactory("VoterProxy", setup.roles.root);

  return await VoterProxy.deploy(mintr.address, setup.tokens.BAL.address, setup.tokens.WethBal.address, setup.tokens.VeBal.address, gaugeControllerMock.address);
};

const getControllerMock = async (setup) => {
  const ControllerMockFactory = await ethers.getContractFactory(
    "ControllerMock",
    setup.roles.root
  );

  return await ControllerMockFactory.deploy();
};

const getExtraRewardMock = async (setup) => {
  const ExtraRewardMockFactory = await ethers.getContractFactory(
    "ExtraRewardMock",
    setup.roles.root
  );

  return await ExtraRewardMockFactory.deploy();
};

const gaugeControllerMock = async (setup) => {
  const GaugeController = await ethers.getContractFactory(
    "GaugeControllerMock",
    setup.roles.root
  );

  return await GaugeController.deploy(setup.tokens.BAL.address, setup.tokens.VeBal.address);
};

const getGaugeMock = async (setup, lpTokenAddress) => {
  const GaugeMock = await ethers.getContractFactory(
    "GaugeMock",
    setup.roles.root
  );
  return await GaugeMock.deploy(lpTokenAddress);
};

const getVotingMock = async (setup) => {
  const VotingMock = await ethers.getContractFactory(
    "VotingMock",
    setup.roles.root
  );
  return await VotingMock.deploy();
};

const getDistroMock = async (setup) => {
  const DistroMock = await ethers.getContractFactory(
    "DistroMock",
    setup.roles.root
  );
  return await DistroMock.deploy();
};

const getExternalContractMock = async (setup) => {
  const DistroMock = await ethers.getContractFactory(
    "ExternalContractMock",
    setup.roles.root
  );
  return await DistroMock.deploy();
};

const getRewardFactory = async (setup) => {
  const RewardFactoryFactory = await ethers.getContractFactory(
    "RewardFactory",
    setup.roles.root
  );

  return await RewardFactoryFactory.deploy(
    setup.roles.operator.address,
    setup.tokens.BAL.address
  );
};

const getSmartWalletCheckerMock = async (setup) => {
  const SmartWalletCheckerFactory = await ethers.getContractFactory(
    "SmartWalletCheckerMock",
    setup.roles.root
  );

  return await SmartWalletCheckerFactory.deploy();
};

module.exports = {
  initialize,
  getVoterProxy,
  getTokens,
  balDepositor,
  rewardFactory,
  controller,
  getMintrMock,
  proxyFactory,
  stashFactory,
  getBaseRewardPool,
  getExtraRewardMock,
  getRewardFactory,
  gaugeControllerMock,
  getControllerMock,
  getGaugeMock,
  getVotingMock,
  getDistroMock,
  getExternalContractMock,
  getSmartWalletCheckerMock,
};
