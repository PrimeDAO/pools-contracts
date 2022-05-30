const { assert } = require("chai");
const { ethers } = require("hardhat");
const { constants } = require("@openzeppelin/test-helpers");

const init = require("../test-init.js");

const deploy = async () => {
  const setup = await init.initialize(await ethers.getSigners());

  setup.tokens = await init.getTokens(setup);

  setup.balDepositor = await init.balDepositor(setup);

  setup.data = {};

  return setup;
};

describe("Contract: BalDepositor", async () => {
  context("» first test", () => {
    before("!! setup", async () => {
      setup = await deploy();
    });

    it("checks if deployed contracts are ZERO_ADDRESS", async () => {
      assert(setup.balDepositor.address != constants.ZERO_ADDRESS);
      assert(setup.tokens.WethBal.address != constants.ZERO_ADDRESS);
      assert(setup.tokens.D2DBal.address != constants.ZERO_ADDRESS);
      assert(setup.tokens.VeBal.address != constants.ZERO_ADDRESS);
    });

    it("checks BalDepositor construtor", async () => {
      const wethBalAdress = await setup.balDepositor.wethBal();
      const staker = await setup.balDepositor.staker();
      const minter = await setup.balDepositor.d2dBal();
      const escrow = await setup.balDepositor.escrow();

      assert(wethBalAdress == setup.tokens.WethBal.address);
      assert(staker == setup.roles.staker.address);
      assert(minter == setup.tokens.D2DBal.address);
      assert(escrow == setup.tokens.VeBal.address);
    });
  });
});