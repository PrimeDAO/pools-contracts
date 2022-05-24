const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const { ethers } = require('hardhat')

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

  const Balancer80BAL20WETH = await ERC20Factory.deploy("Balancer80BAL20WETH", "Balancer80BAL20WETH");
  const BAL = await ERC20Factory.deploy("Bal", "BAL");
  const D2DBal = await D2DBalFactory.deploy("D2DBal", "D2DBAL");
  const PoolContract = await ERC20Factory.deploy("PoolToken", "BALP");
  const WethBal = await ERC20Factory.deploy("WethBal", "WethBAL");
  const VeBal = await VeBalFactory.deploy(WethBal.address, "VeBal", "VeBAL", setup.roles.authorizer_adaptor.address);

  const tokens = { BAL, D2DBal, PoolContract, WethBal, VeBal, Balancer80BAL20WETH }

  setup.tokens = tokens
  return tokens;
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

const getMintrMock = async (setup) => {
  const MintrMock = await ethers.getContractFactory("MintrMock");
  return await MintrMock.deploy(setup.tokens.BAL.address, ZERO_ADDRESS);
}

const proxyFactory = async (setup) => {
  const ProxyFactory = await ethers.getContractFactory(
    "ProxyFactory",
    setup.roles.root
  );

  return await ProxyFactory.deploy();
}

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

  const operator = await getControllerMock(setup)
  const reward = await rewardFactory(setup)
  const fac = await proxyFactory(setup);

  return await StashFactory.deploy(operator.address, reward.address, fac.address);
};

const getBaseRewardPool = async (setup) => {
  const BaseRewardPoolFactory = await ethers.getContractFactory(
    'BaseRewardPoolInTest', 
    setup.roles.root
  );

  const controller = await getControllerMock(setup)

  return await BaseRewardPoolFactory.deploy(1, setup.tokens.Balancer80BAL20WETH.address, setup.tokens.BAL.address, controller.address, setup.roles.reward_manager.address);
}

const getVoterProxy = async (setup) => {
  const VoterProxy = await ethers.getContractFactory("VoterProxy", setup.roles.root);

  const mintr = await getMintrMock(setup);

  // TODO: Fix this
  const gaugeControllerMock = ZERO_ADDRESS;

  return await VoterProxy.deploy(mintr.address, setup.tokens.BAL.address, setup.tokens.VeBal.address, gaugeControllerMock);
};

const getControllerMock = async (setup) => {
  const ControllerMockFactory = await ethers.getContractFactory(
    'ControllerMock',
    setup.roles.root
  )

  return await ControllerMockFactory.deploy()
}

const getExtraRewardMock = async () => {
  const ExtraRewardMockFactory = await ethers.getContractFactory(
    'ExtraRewardMock',
    setup.roles.root
  )

  return await ExtraRewardMockFactory.deploy()
}

const gaugeController = async (setup) => {
  const GaugeController = await ethers.getContractFactory(
    "GaugeControllerMock",
    setup.roles.root
  );         
  return await GaugeController.deploy(setup.tokens.BAL.address, setup.tokens.VeBal.address);
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
  gaugeController,
};
