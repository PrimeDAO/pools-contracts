const { expect } = require("chai");
const { ethers } = require("hardhat");
const { expectRevert } = require("@openzeppelin/test-helpers");
// const {
//   utils: { parseEther, parseUnits },
//   BigNumber,
// } = ethers;

const init = require("./test-init.js");

const deploy = async () => {
  const setup = await init.initialize(await ethers.getSigners());

  setup.token = await init.gettokenInstances(setup);

  setup.controller = await init.controller(setup);

  setup.data = {};

  return setup;
};

// const getDecimals = async (token) => await token.decimals();

// const getTokenAmount = (tokenDecimal) => (amount) =>
//     parseUnits(amount, tokenDecimal.toString());

describe("Contract: Controller", async () => {
  let setup;
  let root;
//   let admin;
//   let buyer1;
//   let buyer2;
//   let buyer3;
//   let staker;

  let platformFee;
  let profitFee;
  let pid;
  let lptoken;
  let gauge;
  let stashVersion;

  //constants
  const zero_address = "0x0000000000000000000000000000000000000000";

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

      platformFee = 500;
      profitFee = 100;
      //TODO: fill () with arguments
    //   await setup.controller.setOwner();
    //   await setup.controller.setPoolManager();
    //   await setup.controller.setFactories();
    //   await setup.controller.setArbitrator();
    //   await setup.controller.setVoteDelegate();
    //   await setup.controller.setRewardContracts();
    //   await setup.controller.setFeeInfo();
    // //   await setup.controller.setFees(); - test below
    //   await setup.controller.setTreasury();

    });

    context("» Testing changed functions", () => {
        context("» setFeeInfo testing", () => {
            // it("Checks feeToken", async () => {
            //     expect((await setup.controller.feeToken()).toString()).to.equal(zero_address);
            //     await setup.controller
            //             .connect(root)
            //             .setFeeInfo(); //crashed with "Error: Transaction reverted: function returned an unexpected amount of data"
            //             //reason of error - not this issue; it should be solved in "Change Curve interactions with Balancer interactions" issue
            //     expectRevert((await setup.controller.feeToken()).toString()).to.equal(zero_address);
            // });
        });
        context("» setFees testing", () => {
            it("Sets correct fees", async () => {
                await setup.controller
                        .connect(root)
                        .setFees(platformFee, profitFee);            
            });
            it("Should fail if total >MaxFees", async () => {
                platformFee = 1000;
                profitFee = 1001;
                //MaxFees = 2000;
                await expectRevert(
                    setup.controller
                        .connect(root)
                        .setFees(platformFee, profitFee),
                    ">MaxFees"
                );                
            });
            it("Should fail if platformFee is too small", async () => {
                platformFee = 400;
                profitFee = 100;
                await setup.controller
                        .connect(root)
                        .setFees(platformFee, profitFee);
                expect((await setup.controller.platformFees()).toString()).to.equal("500");              
            });
            it("Should fail if platformFee is too big", async () => {
                platformFee = 10000;
                profitFee = 100;
                await expectRevert(
                    setup.controller
                        .connect(root)
                        .setFees(platformFee, profitFee),
                    ">MaxFees"
                );  
            });
            it("Should fail if profitFee is too small", async () => {
                platformFee = 500;
                profitFee = 10;
                await setup.controller
                        .connect(root)
                        .setFees(platformFee, profitFee);
                expect((await setup.controller.profitFees()).toString()).to.equal("100");

            });
            it("Should fail if profitFee is too big", async () => {
                platformFee = 500;
                profitFee = 1000;
                await setup.controller
                        .connect(root)
                        .setFees(platformFee, profitFee);
                expect((await setup.controller.profitFees()).toString()).to.equal("100");

            });
        });
        context("» _earmarkRewards testing", () => {
            it("Calls earmarkRewards with non existing pool number", async () => {
                pid = 1;
                await expectRevert(
                    setup.controller
                        .connect(root)
                        .earmarkRewards(pid),
                    "Controller: pool is not exists"
                );  
            });
            // it("Adds pool", async () => { //not this issue; that part shouls be done in "Develop tests for the Controller contract" issue 
            //     // lptoken = ;
            //     // gauge = ;
            //     // stashVersion = ;
            //     expect(
            //         await setup.controller.connect(root).addPool(lptoken, gauge, stashVersion)
            //     ).to.equal(true);
            // });
            // it("Calls earmarkRewards with existing pool number", async () => {
            //     pid = 1;
            //     await expectRevert(
            //         setup.controller
            //             .connect(root)
            //             .earmarkRewards(pid),
            //         "Controller: pool is not exists"
            //     );  
            // });
        });
    });
  });
});
