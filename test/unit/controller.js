const { expect } = require("chai");
const { BigNumber, constants } = require("ethers");
const { deployments, ethers } = require("hardhat");
const { time, expectRevert, BN } = require("@openzeppelin/test-helpers");
const init = require("../test-init.js");

//constants
const zero_address = "0x0000000000000000000000000000000000000000";
const FEE_DENOMINATOR = 10000;
const lockTime = time.duration.days(365);
const halfAYear = lockTime / 2;
const smallLockTime = time.duration.days(30);
const doubleSmallLockTime = time.duration.days(60);
const tenMillion = 30000000;
const twentyMillion = 20000000;
const thirtyMillion = 30000000;
const sixtyMillion = 60000000;
const defaultTimeForBalanceOfVeBal = 0;
const difference = new BN(28944000); // 1684568938 - 1655624938 
const timeDifference = BigNumber.from(difference.toString());

let setup;
let root;
let platformFee;
let profitFee;
let pid;
let rewardFactory;
let stashFactory;
let tokenFactory;
let lptoken;
let gauge;
let stashVersion;
let balBal;
let feeManager;
let treasury;

describe("Controller", function () {

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        const signers = await ethers.getSigners();
        const setup = await init.initialize(await ethers.getSigners());

        const tokens = await init.getTokens(setup);

        const GaugeController = await init.gaugeController(setup);
        
        const VoterProxy = await init.getVoterProxy(setup);
      
        const VoterProxyMockFactory = await init.getVoterProxyMock(setup);
      
        const controller = await init.controller(setup);
      
        const baseRewardPool = await init.baseRewardPool(setup);
      
        const rewardFactory = await init.rewardFactory(setup);
      
        const proxyFactory = await init.proxyFactory(setup);
      
        const stashFactory = await init.stashFactory(setup);
      
        const stashFactoryMock = await init.getStashFactoryMock(setup);
      
        const tokenFactory = await init.tokenFactory(setup);
      
        const extraRewardFactory = await init.getExtraRewardMock(setup);
      
        platformFee = 500;
        profitFee = 100;

        return {
            tokens,
            GaugeController,
            VoterProxy,
            controller,
            rewardFactory,
            proxyFactory,
            stashFactory,
            tokenFactory,
            root: setup.roles.root,
            staker: setup.roles.staker,
            admin: setup.roles.prime,
            reward_manager: setup.roles.reward_manager,
            authorizer_adaptor: setup.roles.authorizer_adaptor,
            operator: setup.roles.operator,
            randomUser: signers.pop(),
        }
    });
    
    context("» setFeeInfo testing", () => {
        it("Checks feeToken", async () => {
            const { controller } = await setupTests();
            expect((await controller.feeToken()).toString()).to.equal(zero_address);
        });
    });
    context("» setFees testing", () => {
        before("setup", async () => {
            const { controller, staker, root } = await setupTests();
        });
        it("Should fail if caller if not feeManager", async () => {
            await expectRevert(
                controller
                    .connect(staker)
                    .setFees(platformFee, profitFee),
                "!auth"
            );      
        });
        it("Sets correct fees", async () => {
            await controller
                    .connect(root)
                    .setFees(platformFee, profitFee);            
        });
        it("Should fail if total >MaxFees", async () => {
            platformFee = 1000;
            profitFee = 1001;
            await expectRevert(
                controller
                    .connect(root)
                    .setFees(platformFee, profitFee),
                ">MaxFees"
            );                
        });
        it("Should fail if platformFee is too small", async () => {
            platformFee = 400;
            profitFee = 100;
            await controller
                    .connect(root)
                    .setFees(platformFee, profitFee);
            expect((await controller.platformFees()).toString()).to.equal("500");              
        });
        it("Should fail if platformFee is too big", async () => {
            platformFee = 10000;
            profitFee = 100;
            await expectRevert(
                controller
                    .connect(root)
                    .setFees(platformFee, profitFee),
                ">MaxFees"
            );  
        });
        it("Should fail if profitFee is too small", async () => {
            platformFee = 500;
            profitFee = 10;
            await controller
                    .connect(root)
                    .setFees(platformFee, profitFee);
            expect((await controller.profitFees()).toString()).to.equal("100");

        });
        it("Should fail if profitFee is too big", async () => {
            platformFee = 500;
            profitFee = 1000;
            await controller
                    .connect(root)
                    .setFees(platformFee, profitFee);
            expect((await controller.profitFees()).toString()).to.equal("100");

        });
    });
});
