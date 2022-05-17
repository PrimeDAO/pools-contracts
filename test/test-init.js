const initialize = async (accounts) => {
    const setup = {};
    setup.roles = {
        root: accounts[0],
        prime: accounts[1],
        staker: accounts[2],
        reward_manager: accounts[3],
        authorizer_adaptor: accounts[4],
        operator: accounts[5],
        buyer1: accounts[6],
        buyer2: accounts[7],
        buyer3: accounts[6],
    };

    return setup;
};

const getVoterProxy = async (setup) => {
    const VoterProxy = await ethers.getContractFactory(
        "VoterProxy",
        setup.roles.root
    );
    // const parameters = args ? args : [];
    // return await VoterProxy.deploy(...parameters);
    const mintr = setup.tokens.D2DBal;
    const bal = setup.tokens.BAL;
    const veBal = setup.tokens.VeBal;
    const gaugeController = setup.tokens.GaugeController;

    let contract = await VoterProxy.deploy(
        mintr.address,
        bal.address,
        veBal.address,
        gaugeController.address
    );
    let contractAddress = contract.address;
    return contractAddress;
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

    const D2DBalFactory = await ethers.getContractFactory(
        "D2DBAL",
        setup.roles.root
    );

    const Balancer80BAL20WETH = await ERC20Factory.deploy(
        "Balancer80BAL20WETH",
        "Balancer80BAL20WETH"
    );

    const BAL = await ERC20Factory.deploy("Bal", "BAL");

    const D2DBal = await D2DBalFactory.deploy();

    const PoolContract = await ERC20Factory.deploy("PoolToken", "BALP");
    const WethBal = await ERC20Factory.deploy("WethBal", "WethBAL");
    const VeBal = await VeBalFactory.deploy(
        WethBal.address,
        "VeBal",
        "VeBAL",
        setup.roles.authorizer_adaptor.address
    );

    const GaugeControllerFactory = await ethers.getContractFactory(
        "GaugeControllerMock",
        setup.roles.root
    );
    //VotingEscrow = VeBal
    const GaugeController = await GaugeControllerFactory.deploy(
        BAL.address,
        VeBal.address
    );

    return {
        BAL,
        D2DBal,
        PoolContract,
        WethBal,
        VeBal,
        GaugeController,
        Balancer80BAL20WETH,
    };
};

const balDepositor = async (setup) => {
    const balDepositor = await ethers.getContractFactory(
        "BalDepositor",
        setup.roles.root
    );
    const balWeth = setup.tokens.WethBal;
    const minter = setup.tokens.D2DBal;
    const staker = await getVoterProxy(setup);

    return await balDepositor.deploy(staker, minter.address, balWeth.address);
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

const controller = async (setup) => {
    const controller = await ethers.getContractFactory(
        "Controller",
        setup.roles.root
    );
    const staker = await ethers.getContract("ERC20Mock");
    const minter = staker;

    return await controller.deploy(
        setup.roles.root.address,
        staker.address,
        minter.address
    );
};

const getControllerMock = async (setup) => {
    const ControllerMockFactory = await ethers.getContractFactory(
        "ControllerMock",
        setup.roles.root
    );

    return await ControllerMockFactory.deploy();
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
    getBaseRewardPool,
    controller,
};
