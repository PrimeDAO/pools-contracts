// const { parseEther } = ethers.utils;

// const PROXY_CREATION = "ProxyCreation";

const initialize = async (accounts) => {
  const setup = {};
  setup.roles = {
    root: accounts[0],
    prime: accounts[1],
    beneficiary: accounts[2],
    buyer1: accounts[3],
    buyer2: accounts[4],
    authorizer_adaptor: accounts[5],
    staker: accounts[6],
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
  //VotingEscrow = VeBal
  const GaugeController = await GaugeControllerFactoty.deploy(BAL.address, VeBal.address);

  return { BAL, D2DBal, PoolContract, WethBal, VeBal, GaugeController };
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

const baseRewardPool = async (setup) => {
  const baseRewardPool = await ethers.getContractFactory(
    "BaseRewardPool",
    setup.roles.root
  );
  const pid = 1; // pool id
  const stakingToken = setup.tokens.D2DBal;
  const rewardToken = setup.tokens.BAL;
  const operator = await setup.controller;
  const rewardManager = setup.roles.reward_manager;

  return await baseRewardPool.deploy(setup.roles.root.address, pid, stakingToken.address, rewardToken.address, operator.address, rewardManager.address);
};

const controller = async (setup) => {
  const controller = await ethers.getContractFactory(
    "Controller",
    setup.roles.root
  );

  const ERC20Mock_Factory =  await ethers.getContractFactory("ERC20Mock", setup.roles.root);  //BAL 
  const ERC20Mock = await ERC20Mock_Factory.deploy("ERC20Mock", "ERC20Mock");

  const staker = ERC20Mock;//await ethers.getContract("ERC20Mock");//await ethers.getContract("ERC20Mock");

  return await controller.deploy(staker.address, setup.roles.root.address);
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

module.exports = {
  initialize,
  getVoterProxy,
  getTokens,
  balDepositor,
  rewardFactory,
  baseRewardPool,
  controller,
};