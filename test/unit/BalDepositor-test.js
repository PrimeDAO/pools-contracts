const { assert } = require("chai");
const { ethers } = require("hardhat");
const { constants } = require("@openzeppelin/test-helpers");

const init = require("../test-init.js");

const deploy = async () => {
    const setup = await init.initialize(await ethers.getSigners());

    setup.tokens = await init.getTokens(setup);

    setup.balDepositor = await init.balDepositor(setup);

    setup.rewardFactory = await init.rewardFactory(setup);

    setup.data = {};

    return setup;
};

describe("Contract: BalDepositor", async () => {
    let incentiveInRange = 15;
    let incentiveOutRange = 45;
    let originalIncentive = 10;
    let root;
    let staker;
    let insufficentDepositAmount = 0;
    let depositAmount = 20;
    let _lock = true;
    let veBalAddress = setup.tokens.VeBal.address;
    let d2dAddress = setup.tokens.D2DBal.address;
    let rewardFactory = setup.rewardFactory.address;
    context("» first test", () => {
        before("!! setup", async () => {
            setup = await deploy();
            root = setup.roles.root;
            staker = setup.roles.staker;
        });
        // first deployment test
        it("checks if deployed contracts are ZERO_ADDRESS", async () => {
            assert(setup.balDepositor.address != constants.ZERO_ADDRESS);
            assert(setup.tokens.WethBal.address != constants.ZERO_ADDRESS);
            assert(setup.tokens.D2DBal.address != constants.ZERO_ADDRESS);
            assert(setup.tokens.VeBal.address != constants.ZERO_ADDRESS);
        });

        it("checks BalDepositor constructor", async () => {
            const wethBalAddress = await setup.balDepositor.wethBal();
            const staker = await setup.balDepositor.staker();
            const minter = await setup.balDepositor.minter();
            const escrow = await setup.balDepositor.escrow();

            assert(wethBalAddress == setup.tokens.WethBal.address);
            assert(staker == setup.roles.staker.address);
            assert(minter == setup.tokens.D2DBal.address);
            assert(escrow == setup.tokens.VeBal.address);
        });
    });
    context("» setFeeManager testing", () => {
        it("Sets the fee manager", async () => {
            await setup.balDepositor.connect(root).setFeeManager(root.address);
            expect(await setup.balDepositor.feeManager()).to.equal(
                root.address
            );
        });
        it("Should fail if caller is not the fee manager", async () => {
            await expectRevert(
                setup.balDepositor.connect(buyer1).setFeeManager(root.address),
                "!auth"
            );
        });
    });
    context("» setFees testing", () => {
        it("Should fail if caller is not the feeManager", async () => {
            await expectRevert(
                setup.balDepositor.connect(buyer1).setFees(incentiveInRange),
                "!auth"
            );
        });
        it("Allow feeManager to set a new lockIncentive", async () => {
            await setup.balDepositor.connect(root).setFees(incentiveInRange);
            expect(await setup.balDepositor.lockIncentive()).to.equal(
                incentiveInRange
            );
        });
        it("Should not update lockIncentive if lockIncentive proposed is outside of the range", async () => {
            await setup.balDepositor.connect(root).setFees(incentiveOutRange);
            expect(await setup.balDepositor.lockIncentive()).to.equal(
                originalIncentive
            );
        });
    });
    context("» deposit testing", () => {
        it("Should fail if deposit amount is too small", async () => {
            await expectRevert(
                setup.balDepositor
                    .connect(root)
                    .deposit(insufficentDepositAmount, _lock, staker.address),
                "!>0"
            );
        });
        it("Should allow deposits, transfer tokens to veBal contract, mint D2DToken, and stake D2DTokens in Rewards contract", async () => {
            await setup.balDepositor
                .connect(root)
                .deposit(depositAmount, _lock, staker.address);

            let vBal_contract_WethBalBalance = await wethBalAddress.balanceOf(
                veBalAddress
            );
            let rewards_Contract_d2dBalance = await d2dAddress.balanceOf(
                rewardFactory
            );

            expect(vBal_contract_WethBalBalance.toString()).to.equal(
                depositAmount.toString()
            );
            expect(rewards_Contract_d2dBalance.toString()).to.equal(
                depositAmount.toString()
            );
        });
    });
});
