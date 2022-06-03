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
    staker: accounts[7]
  };

  return setup;
};

const getTokens = async (setup) => {
    const D2DBalFactory = await ethers.getContractFactory(
      "D2DBal",
      setup.roles.root
    );

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
    // const D2DBal = await ERC20Factory.deploy("D2DBal", "D2DBAL");
    const D2DBal = await D2DBalFactory.deploy();
    const PoolContract = await ERC20Factory.deploy("PoolToken", "BALP");
    const WethBal = await ERC20Factory.deploy("WethBal", "WethBAL"); // Balancer80BAL20WETH LP token
    const VeBal = await VeBalFactory.deploy(WethBal.address, "VeBal", "VeBAL", setup.roles.authorizer_adaptor.address);

    const StashMockFactory = await ethers.getContractFactory(
      "StashMock",
      setup.roles.root
    ); 
    const StashMock = StashMockFactory.deploy();

    const tokens = {
      BAL,
      D2DBal,
      PoolContract,
      WethBal,
      VeBal,
      B50WBTC50WETH,
      StashMock
    };

    setup.tokens = tokens;
    return tokens;
};
// const balDepositor = async (setup) => {
//     const balDepositor = await ethers.getContractFactory(
//         "BalDepositor",
//         setup.roles.root
//     );

//     const staker = setup.voterProxy;

//     return await balDepositor.deploy(
//         setup.tokens.WethBal.address,
//         staker.address,
//         setup.tokens.D2DBal.address
//     );
// };

const getVoterProxyMock = async (setup) => {
  const VoterProxyMockFactory = await ethers.getContractFactory("VoterProxyMock", setup.roles.root);
  const mintr = setup.tokens.D2DBal;
  const bal = setup.tokens.BAL;
  const veBal = setup.tokens.VeBal;
  const gaugeController = await setup.GaugeController;

  return await VoterProxyMockFactory.deploy(mintr.address, bal.address, veBal.address, gaugeController.address)    
};

const getRegistryMock = async (setup) => {
  const RegistryMock = await ethers.getContractFactory("RegistryMock");

  const admin = setup.roles.root;// setup.controller;
  return await RegistryMock.deploy(admin.address);
}

const controller = async (setup) => {
  const controller = await ethers.getContractFactory(
    "Controller",
    setup.roles.root
  );
  const bal = setup.tokens.BAL;
  const wethBal = setup.tokens.WethBal;
  const staker = setup.VoterProxy;
  const registry = setup.RegistryMock;
  return await controller.deploy(staker.address, setup.roles.root.address, wethBal.address, bal.address, registry.address);
};

const tokenFactory = async (setup) => {
  const tokenFactory = await ethers.getContractFactory(
    "TokenFactory",
    setup.roles.root
  );
  const operator = setup.controller;
  return await tokenFactory.deploy(operator.address);
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

const baseRewardPool = async (setup) => {
  const baseRewardPool = await ethers.getContractFactory(
    "BaseRewardPool",
    setup.roles.root
  );
  const pid = 1;
  const stakingToken = setup.tokens.D2DBal;
  const rewardToken = setup.tokens.BAL;
  const operator = setup.controller;
  const rewardManager = setup.rewardFactory;

  return await baseRewardPool.deploy(pid, stakingToken.address, rewardToken.address, operator.address, rewardManager.address);
};

const proxyFactory = async (setup) => {
  const ProxyFactory = await ethers.getContractFactory(
    "ProxyFactory",
    setup.roles.root
  );
  return await ProxyFactory.deploy();
};

// const getMintrMock = async (setup) => {
//   const MintrMock = await ethers.getContractFactory("MintrMock");
//   return await MintrMock.deploy(setup.tokens.BAL.address, ZERO_ADDRESS);
// }

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
  const operator = setup.controller;
  const rewardFactory = setup.rewardFactory;
  const proxyFactory = setup.proxyFactory;
  return await StashFactory.deploy(operator.address, rewardFactory.address, proxyFactory.address);
};

const getStashFactoryMock = async (setup) => {
  const StashFactoryMock = await ethers.getContractFactory(
    "StashFactoryMock",
    setup.roles.root
  );
  const operator = setup.controller;
  const rewardFactory = setup.rewardFactory;
  const proxyFactory = setup.proxyFactory;
  return await StashFactoryMock.deploy(operator.address, rewardFactory.address, proxyFactory.address);
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

// const getVoterProxy = async (setup, gaugeController, mintr) => {
//   const VoterProxy = await ethers.getContractFactory("VoterProxy", setup.roles.root);

//   return await VoterProxy.deploy(mintr.address, setup.tokens.BAL.address, setup.tokens.WethBal.address, setup.tokens.VeBal.address, gaugeController.address);
// };

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

const gaugeController = async (setup) => {
  const GaugeController = await ethers.getContractFactory(
    "GaugeControllerMock",
    setup.roles.root
  );         
  return await GaugeController.deploy(setup.tokens.BAL.address, setup.tokens.VeBal.address);
}; 

// const getVoterProxy = async (setup, gaugeController, mintr) => {
//   const VoterProxy = await ethers.getContractFactory("VoterProxy", setup.roles.root);

//   return await VoterProxy.deploy(mintr.address, setup.tokens.BAL.address, setup.tokens.WethBal.address, setup.tokens.VeBal.address, gaugeController.address);
// };

const getVoterProxy = async (setup, gaugeController, mintr) => {
    const VoterProxy = await ethers.getContractFactory(
        "VoterProxy",
        setup.roles.root
    );

    // const mintr = setup.tokens.D2DBal;
    const wethBal = setup.tokens.WethBal;
    const bal = setup.tokens.BAL;
    const veBal = setup.tokens.VeBal;
    // const gaugeController = setup.GaugeController;
    return await VoterProxy.deploy(
        mintr.address,
        bal.address,
        wethBal.address,
        veBal.address,
        gaugeController.address
    );
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
  baseRewardPool,
  controller,
  getMintrMock,
  proxyFactory,
  stashFactory,
  getBaseRewardPool,
  getExtraRewardMock,
  tokenFactory,
  getVoterProxyMock,
  getStashFactoryMock,
  gaugeController,
  getControllerMock,
  getRewardFactory,
  getRegistryMock,
  getGaugeMock,
  getVotingMock,
  getDistroMock,
  getExternalContractMock,
  getSmartWalletCheckerMock,
};
