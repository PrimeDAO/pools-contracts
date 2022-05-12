const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, expectRevert, BN } = require("@openzeppelin/test-helpers");
const {
  utils: { parseEther, parseUnits },
  BigNumber,
} = ethers;

const init = require("../test-init.js");

const deploy = async () => {
  const setup = await init.initialize(await ethers.getSigners());

  setup.bal = await init.getBAL(setup);

  setup.getTokenInstances = await init.getTokenInstances(setup);

  setup.balDepositor = await init.balDepositor(setup);

  setup.data = {};

  return setup;
};

describe("Contract: BalDepositor", async () => {
  context("» first test", () => {
    before("!! setup", async () => {
      setup = await deploy();
  });
  it("test", async () => {
    // first deployment test
    });
  });
});