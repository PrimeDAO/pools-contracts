const { assert } = require("chai");
const { ethers } = require("hardhat");
const { constants } = require("@openzeppelin/test-helpers");


const init = require("../test-init.js");

const deploy = async () => {
  const setup = await init.initialize(await ethers.getSigners());

  setup.tokenInstances = await init.getTokenInstances(setup);

  setup.balDepositor = await init.balDepositor(setup);

  setup.data = {};

  return setup;
};

describe("Contract: BalDepositor", async () => {
  context("» first test", () => {
    before("!! setup", async () => {
      setup = await deploy();
  });
  // first deployment test
  it("checks if deployed contracts are ZERO_ADDRESS", async () => {
    assert(setup.balDepositor.address != constants.ZERO_ADDRESS);
    assert(setup.tokenInstances.WethBal.address != constants.ZERO_ADDRESS);
    assert(setup.tokenInstances.D2DToken.address != constants.ZERO_ADDRESS);
    assert(setup.tokenInstances.VeBal.address != constants.ZERO_ADDRESS);
  });

  it("checks BalDepositor construtor", async () => {
    assert(setup.balDepositor.address != constants.ZERO_ADDRESS);

    const wethBalAdress = await setup.balDepositor.wethBal();
    const staker = await setup.balDepositor.staker();
    const minter = await setup.balDepositor.minter();
    const escrow =  await setup.balDepositor.escrow();

    assert(wethBalAdress == setup.tokenInstances.WethBal.address);
    assert(staker == setup.roles.staker.address);
    assert(minter == setup.tokenInstances.D2DToken.address);
    assert(escrow == setup.tokenInstances.VeBal.address);
    });
  });
});