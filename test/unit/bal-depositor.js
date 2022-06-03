const { assert, expect } = require("chai");
const { ethers } = require("hardhat");
const init = require("../test-init.js");
const { ONE_HUNDRED_ETHER, MOCK_INITIAL_SUPPLY } = require('../helpers/constants');
const { getCurrentBlockTimestamp } = require("../helpers/helpers.js");

describe("Contract: BalDepositor", async () => {

    let voterProxy, balDepositor, baseRewardPool, wethBal, D2DBal, root, buyer2, veBal;

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

        // root is default signer, and he already has some tokens
        await wethBal.approve(balDepositor.address, MOCK_INITIAL_SUPPLY);

        return {
            voterProxy,
            balDepositor,
            baseRewardPool,
            wethBal,
            veBal: setup.tokens.VeBal,
            D2DBal: setup.tokens.D2DBal,
            tokens: setup.tokens,
            root: setup.roles.root,
            buyer2: setup.roles.buyer2,
        }
    });

    const incentiveInRange = 15;
    const incentiveOutRange = 45;
    const depositAmount = ethers.utils.parseEther('20');

    beforeEach(async function () {
        const setup = await setupTests();
        voterProxy = setup.voterProxy;
        balDepositor = setup.balDepositor;
        baseRewardPool = setup.baseRewardPool;
        wethBal = setup.wethBal;
        veBal = setup.veBal;
        D2DBal = setup.D2DBal;
        tokens = setup.tokens;
        root = setup.root;
        buyer1 = setup.buyer1;
        buyer2 = setup.buyer2;
    });

    context("» first test", () => {
        it("checks BalDepositor constructor", async () => {
            assert(await balDepositor.wethBal() == wethBal.address);
            assert(await balDepositor.staker() == voterProxy.address);
            assert(await balDepositor.minter() == D2DBal.address);
        });
    });
    context("» setFeeManager testing", () => {
        it("sets the fee manager", async () => {
            await balDepositor.setFeeManager(root.address);
            expect(await balDepositor.feeManager()).to.equal(
                root.address
            );
        });
    });
    context("» setFees testing", () => {
        it("allows feeManager to set a new lockIncentive", async () => {
            await balDepositor.setFees(incentiveInRange);
            expect(await balDepositor.lockIncentive()).to.equal(
                incentiveInRange
            );
        });
        it("does not update lockIncentive if lockIncentive proposed is outside of the range", async () => {
            await balDepositor.setFees(incentiveOutRange);
            expect(await balDepositor.lockIncentive()).to.equal(
                10 // default value
            );
        });
    });
    context("» deposit testing", () => {
        it("fails if deposit amount is too small", async () => {
            await voterProxy.setDepositor(balDepositor.address);

            await expect(
                balDepositor.deposit(
                    0,
                    true,
                    voterProxy.address
                )
            ).to.be.revertedWith("InvalidAmount()");
        });

        it('deposits incentive bal and resets it to 0 when we deposit and lock', async function () {
            // initial lock is necessary for deposit to work
            await balDepositor.initialLock();

            expect(await wethBal.balanceOf(balDepositor.address)).to.equals(0)
            expect(await balDepositor.incentiveBal()).to.equals(0)

            // deposit without lock
            await balDepositor.deposit(depositAmount, false, baseRewardPool.address);

            expect(await wethBal.balanceOf(balDepositor.address)).to.equals(depositAmount)

            const lockIncentive = await balDepositor.lockIncentive();
            const feeDenominator = await balDepositor.FEE_DENOMINATOR();

            // formula from code is: deposit amount * lockIncentive / feeDenominator
            const incentiveBal = depositAmount.mul(lockIncentive).div(feeDenominator)
            expect(await balDepositor.incentiveBal()).to.equals(incentiveBal)

            // deposit and lock
            await balDepositor.deposit(depositAmount, true, baseRewardPool.address);

            // lock resets incentive bal
            expect(await balDepositor.incentiveBal()).to.equals(0)
        });
        it("deposits all", async () => {
            // initial lock is necessary for deposit to work
            await balDepositor.initialLock();

            expect(await wethBal.balanceOf(root.address)).to.equals(ethers.utils.parseEther('100000'))

            await balDepositor.depositAll(true, baseRewardPool.address);

            expect(await wethBal.balanceOf(root.address)).to.equals(0)
        });
        it("locks balancer", async () => {
            // initial lock is necessary for deposit to work
            await balDepositor.initialLock();

            // deposit incentive
            await balDepositor.deposit(depositAmount, false, baseRewardPool.address);

            await balDepositor.lockBalancer();
        });
        it("reverts if unauthorized", async () => {
            await expect(balDepositor.connect(buyer2).initialLock()).to.be.revertedWith('Unauthorized()');
        });
        it("return early scenario in _lockBalancer", async () => {
            await wethBal.burnAll(voterProxy.address);
            await balDepositor.lockBalancer();
        });
        it("unlock time buffer", async () => {
            await balDepositor.initialLock();

            const timestampBefore = await getCurrentBlockTimestamp();

            // move block time to 7 days and 1 second
            // we want to keep relocking veBal to max time to have max voting power
            const nextBlockTimestamp = timestampBefore + (60 * 60 * 24 * 7) + 1 ; // 1 week before expiration

            await network.provider.send("evm_setNextBlockTimestamp", [
                nextBlockTimestamp,
            ]);

            // if it extends lock time it should emit event on veBal
            await expect(balDepositor.deposit(depositAmount, true, baseRewardPool.address)).to.emit(veBal, 'Supply');
        });
    });
});
