const initialize = async (accounts) => {
  const setup = {};
  setup.roles = {
    root: accounts[0],
    prime: accounts[1],
    staker: accounts[2],
    reward_manager: accounts[3],
    authorizer_adaptor: accounts[4],
    operator: accounts[5],
  };

  return setup;
};

const getTokens = async (setup) => {
  const ERC20Factory =  await ethers.getContractFactory(
    "CustomERC20Mock",
    setup.roles.root
  ); 

  const VeBalFactory =  await ethers.getContractFactory(
    "VeBalMock",
    setup.roles.root
  );

  const D2DBalFactory = await ethers.getContractFactory(
    "D2DBAL",
    setup.roles.root
  );

  const BAL = await ERC20Factory.deploy("Bal", "BAL");

  const D2DBal = await D2DBalFactory.deploy();

  const PoolContract = await ERC20Factory.deploy("PoolToken", "BALP");
  const WethBal = await ERC20Factory.deploy("WethBal", "WethBAL");
  const VeBal = await VeBalFactory.deploy(WethBal.address, "VeBal", "VeBAL", setup.roles.authorizer_adaptor.address);

  const GaugeControllerFactoty = await ethers.getContractFactory(
    "GaugeControllerMock",
    setup.roles.root
  );         
  const GaugeController = await GaugeControllerFactoty.deploy(BAL.address, VeBal.address);


  const TokenFactoryFactory = await ethers.getContractFactory(
    "TokenFactory",
    setup.roles.root
  );
  const TokenFactory = await TokenFactoryFactory.deploy(setup.roles.operator.address);

  return { BAL, D2DBal, PoolContract, WethBal, VeBal, GaugeController, TokenFactory };
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

const getVoterProxy = async (setup) => {
  const VoterProxy = await ethers.getContractFactory("VoterProxy", setup.roles.root);
  const mintr = setup.tokens.D2DBal;
  const bal = setup.tokens.BAL;
  const veBal = setup.tokens.VeBal;
  const gaugeController = setup.tokens.GaugeController;

  return await VoterProxy.deploy(mintr.address, bal.address, veBal.address, gaugeController.address)    
};

const controller = async (setup) => {
  const controller = await ethers.getContractFactory(
    "Controller",
    setup.roles.root
  );
    //need to change staker mock as addPool need setStashAccess() function            
    //IStaker(staker).setStashAccess(stash, true);
  const wethBal = setup.tokens.WethBal;
  const staker = setup.VoterProxy;
  return await controller.deploy(staker.address, setup.roles.root.address, wethBal.address);
};

const baseRewardPool = async (setup) => {
  const baseRewardPool = await ethers.getContractFactory(
    "BaseRewardPool",
    setup.roles.root
  );
  const pid = 1;
  const stakingToken = setup.tokens.D2DBal;
  const rewardToken = setup.tokens.BAL;
  const operator = setup.controller;
  const rewardManager = setup.roles.reward_manager;

  return await baseRewardPool.deploy(pid, stakingToken.address, rewardToken.address, operator.address, rewardManager.address);
};

const rewardFactory = async (setup) => {
  const RewardFactory = await ethers.getContractFactory(
    "RewardFactory",
    setup.roles.root
  );

  const bal = setup.tokens.BAL;
  const operator = setup.controller;

  return await RewardFactory.deploy(operator.address, bal.address);
};

const proxyFactory = async (setup) => {
  const ProxyFactory = await ethers.getContractFactory(
    "ProxyFactory",
    setup.roles.root
  );
  return await ProxyFactory.deploy();
};

const stashFactory = async (setup) => {
  const StashFactory = await ethers.getContractFactory(
    "StashFactory",
    setup.roles.root
  );
  const operator = setup.controller;
  const rewardFactory = setup.rewardFactory;
  const proxyFactory =  setup.proxyFactory;
  return await StashFactory.deploy(operator.address, rewardFactory.address, proxyFactory.address);
};

module.exports = {
  initialize,
  getVoterProxy,
  getTokens,
  balDepositor,
  rewardFactory,
  baseRewardPool,
  controller,
  stashFactory,
  proxyFactory
};