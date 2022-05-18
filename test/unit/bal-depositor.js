const { assert, expect } = require("chai");
const { ethers } = require("hardhat");
const { constants } = require("ethers");

const init = require("../test-init.js");

const deploy = async () => {
    const setup = await init.initialize(await ethers.getSigners());

    setup.tokens = await init.getTokens(setup);

    setup.balDepositor = await init.balDepositor(setup);

    setup.voterProxy = await init.getVoterProxy(setup);

    setup.baseRewardPool = await init.getBaseRewardPool(setup);

    setup.data = {};

    return setup;
};

describe("Contract: BalDepositor", async () => {
    let root;
    let staker;
    let buyer1;
    let wethBalAdress;
    let minter;
    let balDepositorContractAddress;
    let wethBalContract;
    let voterProxyContract;
    let Bal80BAL20WETH;
    let depositAmount = 20;
    let _lock = true;
    let incentiveInRange = 15;
    let incentiveOutRange = 45;
    let insufficentDepositAmount = 0;
    context("» first test", () => {
        before("!! setup", async () => {
            setup = await deploy();
            root = setup.roles.root;
            buyer1 = setup.roles.buyer1;
            buyer2 = setup.roles.buyer2;
            balDepositorContractAddress = await setup.balDepositor.address;
            Bal80BAL20WETH = await setup.tokens.Balancer80BAL20WETH;
            wethBalContract = await setup.tokens.WethBal;
        });
        // first deployment test
        it("checks if deployed contracts are ZERO_ADDRESS", async () => {
            assert(setup.balDepositor.address != constants.ZERO_ADDRESS);
            assert(setup.tokens.WethBal.address != constants.ZERO_ADDRESS);
            assert(setup.tokens.D2DBal.address != constants.ZERO_ADDRESS);
            assert(setup.tokens.VeBal.address != constants.ZERO_ADDRESS);
        });

        it("checks BalDepositor constructor", async () => {
            wethBalAdress = await setup.balDepositor.wethBal();
            staker = await setup.balDepositor.staker();
            minter = await setup.balDepositor.minter();

            assert(wethBalAdress == setup.tokens.WethBal.address);
            assert(minter == setup.tokens.D2DBal.address);
        });
    });
    context("» setFeeManager testing", () => {
        it("sets the fee manager", async () => {
            await setup.balDepositor.connect(root).setFeeManager(root.address);
            expect(await setup.balDepositor.feeManager()).to.equal(
                root.address
            );
        });
        it("fails if caller is not the fee manager", async () => {
            await expect(
                setup.balDepositor.connect(buyer1).setFeeManager(root.address)
            ).to.be.revertedWith("!auth");
        });
    });
    context("» setFees testing", () => {
        it("fails if caller is not the feeManager", async () => {
            await expect(
                setup.balDepositor.connect(buyer1).setFees(incentiveInRange)
            ).to.be.revertedWith("!auth");
        });
        it("allows feeManager to set a new lockIncentive", async () => {
            await setup.balDepositor.connect(root).setFees(incentiveInRange);
            expect(await setup.balDepositor.lockIncentive()).to.equal(
                incentiveInRange
            );
        });
        it("does not update lockIncentive if lockIncentive proposed is outside of the range", async () => {
            await setup.balDepositor.connect(root).setFees(incentiveOutRange);
            expect(await setup.balDepositor.lockIncentive()).to.equal(
                incentiveInRange
            );
        });
    });
    context("» deposit testing", () => {
        it("fails if deposit amount is too small", async () => {
            await expect(
                setup.balDepositor.deposit(
                    insufficentDepositAmount,
                    _lock,
                    staker
                )
            ).to.be.revertedWith("!>0");
        });
        it("allows deposits, transfers tokens to veBal contract, mints D2DToken, and stakes D2DTokens in Rewards contract", async () => {
            let staker = await setup.balDepositor.staker();
            voterProxyContract = await ethers.getContractAt(
                "VoterProxy",
                staker
            );
            let d2dBalAddress = await setup.balDepositor.minter();
            let d2dBal_Contract = await ethers.getContractAt(
                "D2DBal",
                d2dBalAddress
            );
            await d2dBal_Contract
                .connect(root)
                .transferOwnership(balDepositorContractAddress);

            await voterProxyContract.setDepositor(balDepositorContractAddress);

            await wethBalContract.approve(
                balDepositorContractAddress,
                constants.MaxUint256
            );
            await wethBalContract
                .connect(root)
                .increaseAllowance(setup.baseRewardPool.address, 1000);
            await setup.balDepositor
                .connect(root)
                .deposit(depositAmount, _lock, setup.baseRewardPool.address);

            let rewards_Contract_d2dBalance = await d2dBal_Contract.balanceOf(
                setup.baseRewardPool.address
            );

            expect(rewards_Contract_d2dBalance.toString()).to.equal(
                depositAmount.toString()
            );
        });
    });
});
