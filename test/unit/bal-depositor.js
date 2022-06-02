const { assert, expect } = require("chai");
const { ethers } = require("hardhat");
const { ONE_HUNDRED_ETHER } = require("../helpers/constants.js");
const init = require("../test-init.js");

let root;
let staker;
let buyer1;
let wethBalAdress;
let minter;
let balDepositorContractAddress;
let wethBalContract;
let voterProxyContract;
let d2dBal_Contract;
let veBalContract;
let depositAmount = 20;
let depositAmountTwo = 20;
let _lock = true;
let incentiveInRange = 15;
let incentiveOutRange = 45;
let insufficentDepositAmount = 0;

describe("Contract: BalDepositor", async () => {

    const setupTests = deployments.createFixture(async () => {
        const signers = await ethers.getSigners();
        const setup = await init.initialize(signers);
        await init.getTokens(setup);
        const gaugeControllerMock = await init.gaugeController(setup);
        const mintr = await init.getMintrMock(setup);
        const voterProxy = await init.getVoterProxy(setup, gaugeControllerMock, mintr);
        const balDepositor = await init.balDepositor(setup, voterProxy);
        const baseRewardPool = await init.getBaseRewardPool(setup);

        // We need to whitelist voterProxy on veBal
        const smartWalletChecker = await init.getSmartWalletCheckerMock(setup);
        await setup.tokens.VeBal.connect(setup.roles.authorizer_adaptor).commit_smart_wallet_checker(smartWalletChecker.address);
        await setup.tokens.VeBal.connect(setup.roles.authorizer_adaptor).apply_smart_wallet_checker();
        await smartWalletChecker.allow(voterProxy.address);

        // Set depositor on voter proxy
        await voterProxy.setDepositor(balDepositor.address)

        const wethBal = setup.tokens.WethBal;

        await wethBal.mint(voterProxy.address, ONE_HUNDRED_ETHER);

        return {
            voterProxy,
            balDepositor,
            baseRewardPool,
            wethBal,
            D2DBal: setup.tokens.D2DBal,
            tokens: setup.tokens,
            root: setup.roles.root,
            buyer1: setup.roles.buyer1,
            buyer2: setup.roles.buyer2,
        }
    });

    context("» first test", () => {
        before("!! setup", async () => {
            setup = await deploy();
            root = setup.roles.root;
            buyer1 = setup.roles.operator;
            buyer2 = setup.roles.buyer2;
            balDepositorContractAddress = await setup.balDepositor.address;
            wethBalContract = await setup.tokens.WethBal;
            veBalContract = await setup.tokens.VeBal;
            voterProxyContract = setup.voterProxy;
            d2dBal_Contract = setup.tokens.D2DBal;
        });
        // first deployment test
        it("checks if deployed contracts are ZERO_ADDRESS", async () => {
            assert(setup.balDepositor.address != constants.ZERO_ADDRESS);
            assert(setup.tokens.WethBal.address != constants.ZERO_ADDRESS);
            assert(setup.tokens.D2DBal.address != constants.ZERO_ADDRESS);
            assert(setup.tokens.VeBal.address != constants.ZERO_ADDRESS);
        });

        it("checks BalDepositor constructor", async () => {
            const { balDepositor, wethBal, voterProxy, D2DBal } = await setupTests();

            assert(await balDepositor.wethBal() == wethBal.address);
            assert(await balDepositor.staker() == voterProxy.address);
            assert(await balDepositor.minter() == D2DBal.address);
        });
    });
    context("» setFeeManager testing", () => {
        it("sets the fee manager", async () => {
            const { balDepositor, root } = await setupTests();

            await balDepositor.setFeeManager(root.address);
            expect(await balDepositor.feeManager()).to.equal(
                root.address
            );
        });
        it("fails if caller is not the fee manager", async () => {
            const { balDepositor, buyer1, root } = await setupTests();

            await expect(
                balDepositor.connect(buyer1).setFeeManager(root.address)
            ).to.be.revertedWith("!auth");
        });
    });
    context("» setFees testing", () => {
        it("fails if caller is not the feeManager", async () => {
            const { balDepositor, buyer1 } = await setupTests();

            await expect(
                balDepositor.connect(buyer1).setFees(incentiveInRange)
            ).to.be.revertedWith("!auth");
        });
        it("allows feeManager to set a new lockIncentive", async () => {
            const { balDepositor } = await setupTests();

            await balDepositor.setFees(incentiveInRange);
            expect(await balDepositor.lockIncentive()).to.equal(
                incentiveInRange
            );
        });
        it("does not update lockIncentive if lockIncentive proposed is outside of the range", async () => {
            const { balDepositor } = await setupTests();

            await balDepositor.setFees(incentiveOutRange);
            expect(await balDepositor.lockIncentive()).to.equal(
                10 // default value
            );
        });
    });
    context("» deposit testing", () => {
        it("fails if deposit amount is too small", async () => {
            const { voterProxy, balDepositor } = await setupTests();

            await voterProxy.setDepositor(balDepositor.address);

            await expect(
                balDepositor.deposit(
                    0,
                    true,
                    voterProxy.address
                )
            ).to.be.revertedWith("!>0");
        });
        it("allows deposits, transfers Wethbal to veBal contract, mints D2DToken, and stakes D2DTokens in Rewards contract", async () => {
            await wethBalContract.mint(root.address, depositAmount);
            await wethBalContract.connect(root).approve(
                balDepositorContractAddress,
                depositAmount
            );

            await setup.balDepositor
                .connect(root)
                .deposit(depositAmount, _lock, setup.baseRewardPool.address);

            let rewards_Contract_d2dBalance = await d2dBal_Contract.balanceOf(
                setup.baseRewardPool.address
            );

            let vBal_contract_WethBalBalance = await wethBalContract.balanceOf(
                veBalContract.address
            );
            //Check if the appropriate amount of d2dBal was minted and sent to rewards contract
            expect(rewards_Contract_d2dBalance.toString()).to.equal(
                depositAmount.toString()
            );
            //Check if the appropriate amount of Wethbal was sent via voter proxy to veBal contract
            expect(vBal_contract_WethBalBalance.toString()).to.equal(
                depositAmount.toString()
            );
        });
        it("Transfers Wethbal to Baldepositor contract when lock boolean is false", async () => {
            let lock_false = false;
            let depositTotal = depositAmount + depositAmountTwo;

            await wethBal.approve(balDepositor.address, ONE_HUNDRED_ETHER);

            // initial lock is necessary for deposit to work
            await balDepositor.initialLock();

            await balDepositor.deposit(depositAmount, true, baseRewardPool.address);
        });
    });
});
