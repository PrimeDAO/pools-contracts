const initialize = async (accounts) => {
  const setup = {};
  setup.roles = {
    root: accounts[0],
    prime: accounts[1],
    staker: accounts[2],
    reward_manager: accounts[3],
    authorizer_adaptor: accounts[4]
  };

  return setup;
};

const getVoterProxy = async (setup) => {
  const VoterProxy = await ethers.getContractFactory("VoterProxy", setup.roles.root);
  const parameters = args ? args : [];
  return await VoterProxy.deploy(...parameters);
};

const getTokens = async (setup) => {
  const ERC20_Factory =  await ethers.getContractFactory(
    "ERC20Mock",
    setup.roles.root
  ); 

  const VeBal_Factory =  await ethers.getContractFactory(
    "VeBalMock",
    setup.roles.root
  );

  const D2DBal_Factory = await ethers.getContractFactory(
    "D2DBAL",
    setup.roles.root
  );

  const BAL = await ERC20_Factory.deploy("Bal", "BAL");

  const D2DBal = await D2DBal_Factory.deploy();

  const PoolContract = await ERC20_Factory.deploy("PoolToken", "BALP");
  const WethBal = await ERC20_Factory.deploy("WethBal", "WethBAL");
  const VeBal = await VeBal_Factory.deploy(WethBal.address, "VeBal", "VeBAL", setup.roles.authorizer_adaptor.address);

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
  const staker = await ethers.getContract("ERC20Mock");
  const minter = staker;

  return await controller.deploy(setup.roles.root.address, staker.address, minter.address);
};

module.exports = {
  initialize,
  getVoterProxy,
  getTokens,
  balDepositor,
  baseRewardPool,
  controller,
};
