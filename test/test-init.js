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
    buyer3: accounts[5],
    buyer4: accounts[6],
  };

  return setup;
};

const getBAL = async (setup) => {
  const BAL_ADDRESS =  await ethers.getContractFactory("ERC20Mock", setup.roles.root);  //BAL 
  return { BAL_ADDRESS };
};

//(done)
const getVoterProxy = async (setup) => {
  const VoterProxy = await ethers.getContractFactory("VoterProxy", setup.roles.root);
  const parameters = args ? args : [];
  return await VoterProxy.deploy(...parameters);
};
//??? or this?? need VoterProxy contract to finish this
// const VoterProxyProxyFactoryFactory = await ethers.getContractFactory(
//   "VoterProxyProxyFactory",
//   setup.roles.prime
// );
// const VoterProxyFactoryInstance =
//   await VoterProxyFactoryFactory.deploy();

// const proxy_tx = await VoterProxyProxyFactoryInstance
//   .connect(setup.roles.prime)
//   .createProxy(setup.VoterProxy.address, "0x00");
// const proxy_receit = await proxy_tx.wait();
// const proxy_addr = proxy_receit.events.filter((data) => {
//   return data.event === PROXY_CREATION;
// })[0].args["proxy"];
// return await ethers.getContractAt("VoterProxy", proxy_addr);
// };


// const getContractInstance = async (factoryName, address, args) => {
//   const Factory = await ethers.getContractFactory(factoryName, address);
//   const parameters = args ? args : [];
//   return await Factory.deploy(...parameters);
// };

//(done)
const gettokenInstances = async (setup) => {
  const D2DToken_Factory = await ethers.getContractFactory(
    "D2DToken",
    setup.roles.root
  );
  const decimals = 10; //10 only for example here

  const D2DToken = await D2DToken_Factory.deploy(
    decimals,
    setup.roles.root.address
  );

  // const PoolContract_Factory = await ethers.getContractFactory(
  //   "PoolContract",
  //   setup.roles.root
  // );
  const PoolContract = await ERC20_Factory.deploy("Pool Contract", "BALP", decimals);

  return { D2DToken, PoolContract };
};

const balDepositor = async (setup) => {
  const balDepositor = await ethers.getContractFactory(
    "BalDepositor",
    setup.roles.root
  );
  const minterInstance = await ethers.getContract("D2DToken");
  const staker = address();
  const veBal = await ethers.getContract("veBal");
  const escrow = veBal;
  return await balDepositor.deploy(setup.roles.root.address, staker, minterInstance.address, escrow);
};

const baseRewardPool = async (setup) => {
  const baseRewardPool = await ethers.getContractFactory(
    "SignerV2",
    setup.roles.root
  );
  const pid = 1; //1 for example (set correct later_)
  const stakingTokenInstance = await ethers.getContract("D2DToken");
  const rewardToken = BAL_ADDRESS;
  const operator = await ethers.getContract("Controller");
  const rewardManager = "0xedccb35798fae4925718a43cc608ae136208aa8d";

  return await baseRewardPool.deploy(setup.roles.root.address, pid, stakingTokenInstance.address, rewardToken, operator.address, rewardManager);
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
  getBAL,
  getVoterProxy,
  gettokenInstances,
  balDepositor,
  baseRewardPool,
  controller,
};
