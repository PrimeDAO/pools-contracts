const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const init = require("../test-init.js");
const { ONE_ADDRESS } = require('../helpers/constants')

describe("StashFactory", function () {

    const setupTests = deployments.createFixture(async () => {
        const signers = await ethers.getSigners();
        const setup = await init.initialize(await ethers.getSigners());
        await init.getTokens(setup);
        setup.GaugeController = await init.gaugeController(setup);
  
        setup.VoterProxy = await init.getVoterProxyMock(setup);
      
        setup.controller = await init.getControllerMock(setup);
      
        setup.rewardFactory = await init.rewardFactory(setup);

        setup.baseRewardPool = await init.baseRewardPool(setup);
            
        setup.proxyFactory = await init.proxyFactory(setup);

        const stashFactory = await init.stashFactory(setup);
        return {
            stashFactory,
            root: setup.roles.root,
            randomUser: signers.pop(),
        };
    });

    it("reverts if unauthorized on setImplementation", async function () {
        const { stashFactory, randomUser } = await setupTests();
        await expect(
            stashFactory.connect(randomUser).setImplementation(ONE_ADDRESS)
        ).to.be.revertedWith("Unauthorized()");
    });

    it("set implementation and create stash works", async function () {
        const { stashFactory, root } = await setupTests();

        // We need to do it this way because previous test is calling operator.owner() so we can't use EOA

        // Get operator address
        const operatorAddress = await stashFactory.operator();

        //Get mock factory and attach to that address
        const operator = await ethers
            .getContractFactory("ControllerMock")
            .then((x) => x.attach(operatorAddress));

        // Deploy implementation contract
        const implementationAddress = await ethers
            .getContractFactory("StashMock")
            .then((x) => x.deploy())
            .then((x) => x.address);

        // Set implementation contract
        await expect(
            stashFactory.connect(root).setImplementation(implementationAddress)
        )
            .to.emit(stashFactory, "ImpelemntationChanged")
            .withArgs(implementationAddress);

        await expect(operator.createStash(stashFactory.address)).to.emit(
            operator,
            "StashCreated"
        );
    });

    it("reverts if unauthorized on createStash", async function () {
        const { stashFactory, randomUser } = await setupTests();

        await expect(
            stashFactory
                .connect(randomUser)
                .createStash(1, ZERO_ADDRESS, ZERO_ADDRESS)
        ).to.be.revertedWith("Unauthorized()");
    });
});
