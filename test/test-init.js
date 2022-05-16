const { deployments } = require('hardhat')

const initialize = async (accounts) => {
  const setup = {};
  setup.roles = {
    root: accounts[0],
    prime: accounts[1],
    staker: accounts[2],
    reward_manager: accounts[3],
    authorizer_adaptor: accounts[4],
    operator: accounts[5]    
  };

  return setup;
};

const getVoterProxy = async (setup) => {
  const VoterProxy = await ethers.getContractFactory("VoterProxy", setup.roles.root);
  const parameters = args ? args : [];
  return await VoterProxy.deploy(...parameters);
};

const getTokens = async (setup) => {
  const ERC20Factory =  await ethers.getContractFactory(
    "ERC20Mock",
    setup.roles.root
  ); 

  const VeBalFactory =  await ethers.getContractFactory(
    "VeBalMock",
    setup.roles.root
  );

  const D2DBalFactory = await ethers.getContractFactory(
    "ERC20Mock",
    setup.roles.root
  );

  const BAL = await ERC20Factory.deploy("Bal", "BAL");

  const D2DBal = await D2DBalFactory.deploy("D2D", "D2D");

  const PoolContract = await ERC20Factory.deploy("PoolToken", "BALP");
  const WethBal = await ERC20Factory.deploy("WethBal", "WethBAL");
  const VeBal = await VeBalFactory.deploy(WethBal.address, "VeBal", "VeBAL", setup.roles.authorizer_adaptor.address);

  return { BAL, D2DBal, PoolContract, WethBal, VeBal };
};

const balDepositor = async (setup) => {
  const balDepositor = await ethers.getContractFactory(
    "BalDepositor",
    setup.roles.root
  );
  const wethBal = setup.tokens.WethBal;
  const minter =  setup.tokens.D2DBal;
  const staker =  setup.roles.staker;
  const escrow =  setup.tokens.VeBal;

  return await balDepositor.deploy(wethBal.address, staker.address, minter.address, escrow.address);
};

const controller = async (setup) => {
  const controller = await ethers.getContractFactory(
    "Controller",
    setup.roles.root
  );
  const staker = await ethers.getContract("ERC20Mock");
  const minter = staker;

  return await controller.deploy(setup.roles.root.address, staker.address, minter.address);
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

const getBaseRewardPool = async () => {
  const BaseRewardPoolDeployement = await deployments.get("BaseRewardPool");
  const BaseRewardPool = await hre.ethers.getContractFactory("BaseRewardPoolInTest");
  return BaseRewardPool.attach(BaseRewardPoolDeployement.address);
}

const getControllerMock = async () => {
  const ControllerDeployement = await deployments.get("ControllerMock");
  const ControllerMock = await hre.ethers.getContractFactory("ControllerMock");
  return ControllerMock.attach(ControllerDeployement.address);
}

const getVeBalMock = async () => {
  const veBalMockDeployement = await deployments.get("veBalMock");
  const VeBalMock = await hre.ethers.getContractFactory("veBalMock");
  return VeBalMock.attach(veBalMockDeployement.address);
}

const getBalMock = async () => {
  const BalMockDeployement = await deployments.get("BalMock");
  const BalMock = await hre.ethers.getContractFactory("ERC20Mock");
  return BalMock.attach(BalMockDeployement.address);
}

const getBalancer80BAL20WETHMock = async () => {
  const Balancer80BAL20WETHMockDeployement = await deployments.get("Balancer80BAL20WETHMock");
  const Balancer80BAL20WETHMoc = await hre.ethers.getContractFactory("ERC20Mock");
  return Balancer80BAL20WETHMoc.attach(Balancer80BAL20WETHMockDeployement.address);
}

const getD2DTokenMock = async () => {
  const D2DTokenDeployement = await deployments.get("D2DTokenMock");
  const D2DToken = await hre.ethers.getContractFactory("D2DToken");
  return D2DToken.attach(D2DTokenDeployement.address);
}

const getExtraRewardMock = async () => {
  const ExtraRewardMockDeployement = await deployments.get("ExtraRewardMock");
  const ExtraRewardMock = await hre.ethers.getContractFactory("ExtraRewardMock");
  return ExtraRewardMock.attach(ExtraRewardMockDeployement.address);
}

module.exports = {
  initialize,
  getVoterProxy,
  getTokens,
  balDepositor,
  rewardFactory,
  controller,
  getBaseRewardPool,
  getBalMock,
  getVeBalMock,
  getD2DTokenMock,
  getControllerMock,
  getExtraRewardMock,
  getBalancer80BAL20WETHMock,
};
