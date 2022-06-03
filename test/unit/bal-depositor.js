const { assert, expect } = require("chai");
const { ethers } = require("hardhat");
const { ONE_HUNDRED_ETHER } = require("../helpers/constants.js");
const init = require("../test-init.js");

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

    const incentiveInRange = 15;
    const incentiveOutRange = 45;
    const depositAmount = 20;

    context("» first test", () => {
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
        it("deposits wethBal", async () => {
            const { voterProxy, balDepositor, wethBal, baseRewardPool, tokens } = await setupTests();

            await wethBal.approve(balDepositor.address, ONE_HUNDRED_ETHER);

            await wethBal.mint(tokens.VeBal.address, ONE_HUNDRED_ETHER);
            await wethBal.mint(voterProxy.address, ONE_HUNDRED_ETHER);
  
            // initial lock is necessary for deposit to work
            await balDepositor.initialLock();

            await balDepositor.deposit(depositAmount, true, baseRewardPool.address);
        });
    });
});
