const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, expectRevert, BN } = require("@openzeppelin/test-helpers");
const {
  utils: { parseEther, parseUnits },
  BigNumber,
} = ethers;

const init = require("./test-init.js");

const deploy = async () => {
  const setup = await init.initialize(await ethers.getSigners());

  setup.controller = await init.getContractInstance("Controller", setup.roles.prime);

  setup.token = await init.gettokenInstances(setup);

  setup.data = {};

  return setup;
};

const getDecimals = async (token) => await token.decimals();

const getTokenAmount = (tokenDecimal) => (amount) =>
    parseUnits(amount, tokenDecimal.toString());

describe("Contract: Controller", async () => {
  let setup;
  let root;
  let admin;
  let buyer1;
  let buyer2;
  let buyer3;
  let buyer4;

  let Controller;

  let platformFee;
  let profitFee;

  context("» creator is avatar", () => {
    before("!! setup", async () => {
      setup = await deploy();


      // // Roles
      root = setup.roles.root;
      beneficiary = setup.roles.beneficiary;
      admin = setup.roles.prime;
      buyer1 = setup.roles.buyer1;
      buyer2 = setup.roles.buyer2;
      buyer3 = setup.roles.buyer3;
      buyer4 = setup.roles.buyer4;


      await setup.controller.setOwner();
      await setup.controller.setFeeManager();
      await setup.controller.setPoolManager();
      await setup.controller.setFactories();
      await setup.controller.setArbitrator();
      await setup.controller.setVoteDelegate();
      await setup.controller.setRewardContracts();
      await setup.controller.setFeeInfo();
    //   await setup.controller.setFees(); - test below
      await setup.controller.setTreasury();

    });

    context("» Testing changed functions", () => {
        context("» setFees testing", () => {
            it("Should fail if setFeeManager caller is not the fee m/anager ", async () => {
                await setup.controller.setFees()
                
                let tx = Depositor.connect(addr1).setFeeManager(addr1.address);
                await expect(tx).to.be.revertedWith("!auth");
            });
        });
    });
  });

});
