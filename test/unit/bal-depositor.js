const { assert, expect } = require("chai");
const { ethers } = require("hardhat");
const { constants } = require("ethers");

const init = require("../test-init.js");

const deploy = async () => {
  const setup = await init.initialize(await ethers.getSigners());

  setup.tokens = await init.getTokens(setup);

  setup.voterProxy = await init.getVoterProxy(setup);

  setup.balDepositor = await init.balDepositor(setup);

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
  let d2dBal_Contract;
  let veBalContract;
  let depositAmount = 20;
  let depositAmountTwo = 20;
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
      wethBalAdress = await setup.balDepositor.wethBal();
      staker = await setup.balDepositor.staker();
      minter = await setup.balDepositor.minter();

      assert(wethBalAdress == setup.tokens.WethBal.address);
      assert(staker == setup.voterProxy.address);
      assert(minter == setup.tokens.D2DBal.address);
    });
  });
  context("» setFeeManager testing", () => {
    it("sets the fee manager", async () => {
      await setup.balDepositor.connect(root).setFeeManager(root.address);
      expect(await setup.balDepositor.feeManager()).to.equal(root.address);
    });
    it("fails if caller is not the fee manager", async () => {
      await expect(setup.balDepositor.connect(buyer1).setFeeManager(root.address)).to.be.revertedWith("!auth");
    });
  });
  context("» setFees testing", () => {
    it("fails if caller is not the feeManager", async () => {
      await expect(setup.balDepositor.connect(buyer1).setFees(incentiveInRange)).to.be.revertedWith("!auth");
    });
    it("allows feeManager to set a new lockIncentive", async () => {
      await setup.balDepositor.connect(root).setFees(incentiveInRange);
      expect(await setup.balDepositor.lockIncentive()).to.equal(incentiveInRange);
    });
    it("does not update lockIncentive if lockIncentive proposed is outside of the range", async () => {
      await setup.balDepositor.connect(root).setFees(incentiveOutRange);
      expect(await setup.balDepositor.lockIncentive()).to.equal(incentiveInRange);
    });
  });
  context("» deposit testing", () => {
    before("setup", async () => {
      await d2dBal_Contract.connect(root).transferOwnership(balDepositorContractAddress);

      await voterProxyContract.connect(root).setDepositor(balDepositorContractAddress);
    });
    it("fails if deposit amount is too small", async () => {
      await expect(setup.balDepositor.deposit(insufficentDepositAmount, _lock, staker)).to.be.revertedWith("!>0");
    });
    it("allows deposits, transfers Wethbal to veBal contract, mints D2DToken, and stakes D2DTokens in Rewards contract", async () => {
      await wethBalContract.approve(balDepositorContractAddress, depositAmount);

      await setup.balDepositor.connect(root).deposit(depositAmount, _lock, setup.baseRewardPool.address);

      let rewards_Contract_d2dBalance = await d2dBal_Contract.balanceOf(setup.baseRewardPool.address);

      let vBal_contract_WethBalBalance = await wethBalContract.balanceOf(veBalContract.address);
      //Check if the appropriate amount of d2dBal was minted and sent to rewards contract
      expect(rewards_Contract_d2dBalance.toString()).to.equal(depositAmount.toString());
      //Check if the appropriate amount of Wethbal was sent via voter proxy to veBal contract
      expect(vBal_contract_WethBalBalance.toString()).to.equal(depositAmount.toString());
    });
    it("Transfers Wethbal to Baldepositor contract when lock boolean is false", async () => {
      let lock_false = false;
      let depositTotal = depositAmount + depositAmountTwo;

      await wethBalContract.approve(balDepositorContractAddress, depositAmount);

      await setup.balDepositor.connect(root).deposit(depositAmount, lock_false, setup.baseRewardPool.address);

      let rewards_Contract_d2dBalance = await d2dBal_Contract.balanceOf(setup.baseRewardPool.address);

      let balDepositor_contract_WethBalBalance = await wethBalContract.balanceOf(balDepositorContractAddress);

      expect(rewards_Contract_d2dBalance.toString()).to.equal(depositTotal.toString());
      //Check if the appropriate amount of Wethbal was sent to balDepositor contract
      expect(balDepositor_contract_WethBalBalance.toString()).to.equal(depositAmount.toString());
    });
  });
});
