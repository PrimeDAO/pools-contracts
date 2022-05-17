const { expect } = require("chai");
const { ethers } = require("hardhat");
// const { constants } = require("@openzeppelin/test-helpers");
const { expectRevert } = require("@openzeppelin/test-helpers");


const init = require("../test-init.js");

const deploy = async () => {
  const setup = await init.initialize(await ethers.getSigners());

  setup.tokens = await init.getTokens(setup);
  
  setup.VoterProxy = await init.getVoterProxy(setup);

  setup.controller = await init.controller(setup);

  setup.baseRewardPool = await init.baseRewardPool(setup);

  setup.rewardFactory = await init.rewardFactory(setup);

//   setup.proxyFactory = await init.proxyFactory(setup);

//   setup.stashFactory = await init.stashFactory(setup);

  setup.data = {};

  return setup;
};

describe("Contract: Controller", async () => {
  let setup;
  let root;

  let platformFee;
  let profitFee;
  let pid;
  let rewardFactory;
  let stashFactory;
  let tokenFactory;
//   let lptoken;
//   let gauge;
//   let stashVersion;

  //constants
//   const zero_address = "0x0000000000000000000000000000000000000000";
// context("» first test", () => {
//     before("!! setup", async () => {
//       setup = await deploy();
//   });
//   // first deployment test
//   it("checks if deployed contracts are ZERO_ADDRESS", async () => {
//     assert(setup.balDepositor.address != constants.ZERO_ADDRESS);
//     assert(setup.tokens.WethBal.address != constants.ZERO_ADDRESS);
//     assert(setup.tokens.D2DBal.address != constants.ZERO_ADDRESS);
//     assert(setup.tokens.VeBal.address != constants.ZERO_ADDRESS);
//   });

//   it("checks Controller construtor", async () => {
//     const wethBalAdress = await setup.balDepositor.wethBal();
//     const staker = await setup.balDepositor.staker();
//     const minter = await setup.balDepositor.minter();
//     const escrow =  await setup.balDepositor.escrow();

//     assert(wethBalAdress == setup.tokens.WethBal.address);
//     assert(staker == setup.roles.staker.address);
//     assert(minter == setup.tokens.D2DBal.address);
//     assert(escrow == setup.tokens.VeBal.address);
//     });
// });

  context("» creator is avatar", () => {
    before("!! setup", async () => {
      setup = await deploy();


      // // Roles
      root = setup.roles.root;
      staker = setup.roles.staker;
      admin = setup.roles.prime;
      reward_manager = setup.roles.reward_manager;
      authorizer_adaptor = setup.roles.authorizer_adaptor;
      operator = setup.roles.operator;

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
        // context("» setFeeInfo testing", () => {
        //     it("Checks feeToken", async () => {
        //         expect((await setup.controller.feeToken()).toString()).to.equal(zero_address);
        //         await setup.controller
        //                 .connect(root)
        //                 .setFeeInfo(); //crashed with "Error: Transaction reverted: function returned an unexpected amount of data"
        //                 //reason of error - not this issue; it should be solved in "Change Curve interactions with Balancer interactions" issue
        //         expectRevert((await setup.controller.feeToken()).toString()).to.equal(zero_address);
        //     });
        // });
        // context("» setFees testing", () => {
        //     it("Sets correct fees", async () => {
        //         await setup.controller
        //                 .connect(root)
        //                 .setFees(platformFee, profitFee);            
        //     });
        //     it("Should fail if total >MaxFees", async () => {
        //         platformFee = 1000;
        //         profitFee = 1001;
        //         //MaxFees = 2000;
        //         await expectRevert(
        //             setup.controller
        //                 .connect(root)
        //                 .setFees(platformFee, profitFee),
        //             ">MaxFees"
        //         );                
        //     });
        //     it("Should fail if platformFee is too small", async () => {
        //         platformFee = 400;
        //         profitFee = 100;
        //         await setup.controller
        //                 .connect(root)
        //                 .setFees(platformFee, profitFee);
        //         expect((await setup.controller.platformFees()).toString()).to.equal("500");              
        //     });
        //     it("Should fail if platformFee is too big", async () => {
        //         platformFee = 10000;
        //         profitFee = 100;
        //         await expectRevert(
        //             setup.controller
        //                 .connect(root)
        //                 .setFees(platformFee, profitFee),
        //             ">MaxFees"
        //         );  
        //     });
        //     it("Should fail if profitFee is too small", async () => {
        //         platformFee = 500;
        //         profitFee = 10;
        //         await setup.controller
        //                 .connect(root)
        //                 .setFees(platformFee, profitFee);
        //         expect((await setup.controller.profitFees()).toString()).to.equal("100");

        //     });
        //     it("Should fail if profitFee is too big", async () => {
        //         platformFee = 500;
        //         profitFee = 1000;
        //         await setup.controller
        //                 .connect(root)
        //                 .setFees(platformFee, profitFee);
        //         expect((await setup.controller.profitFees()).toString()).to.equal("100");

        //     });
        // });
        context("» _earmarkRewards testing", () => {
            // it("Calls earmarkRewards with non existing pool number", async () => {
            //     pid = 1;
            //     await expectRevert(
            //         setup.controller
            //             .connect(root)
            //             .earmarkRewards(pid),
            //         "Controller: pool is not exists"
            //     );  
            // });
            it("Sets VoterProxy operator ", async () => {
                expect(await setup.VoterProxy.connect(root).setOperator(setup.controller.address));
            });
            // it("Sets factories", async () => { //not this issue; now it is
            //     rewardFactory = setup.rewardFactory;
            //     stashFactory = setup.stashFactory; //stash to handle extra incentives
            //     tokenFactory = setup.tokens.TokenFactory; //create a tokenized deposit //booster tokenFactory https://etherscan.io/address/0x3c995e43e6ddd551e226f4c5544c77bfed147ab9                
            //     expect(await setup.controller.connect(root).setFactories(rewardFactory.address, stashFactory.address, tokenFactory.address));
            //     // Error: VM Exception while processing transaction: reverted with reason string '!auth'
            //     // at RewardFactory.CreateBalRewards 
            // });
            // it("Sets VoterProxy as StashFactory implementation ", async () => {
            //     expect(await setup.stashFactory.connect(root).setImplementation(setup.VoterProxy.address, setup.VoterProxy.address, setup.VoterProxy.address));
            // });
            // it("Adds pool", async () => { //not this issue; now it is
            //     //lp token is unwithdrawable --> PoolToken
            //     lptoken = setup.tokens.PoolContract; //address; 
            //     //reward contract is going to be BAL
            //     gauge = setup.tokens.GaugeController;// gauge controller Mock //https://dev.balancer.fi/resources/vebal-and-gauges/gauges
            //     stashVersion = 1; //uint256
            //     await setup.controller.connect(root).addPool(lptoken.address, gauge.address, stashVersion);
            //     expect(
            //         (await setup.controller.poolLength()).toNumber()
            //     ).to.equal(1);
            //     // expect(
            //     //     await tokenFactory.token()
            //     // ).to.equal(1);
            //     // expect(
            //     //     await tokenFactory.token()
            //     // ).to.equal(gauge.address);
            //     //TODO: add more expects for added data
            //     // console.log("lptoken %s ", lptoken.address);
            //     console.log("\nbaseRewardPool %s ", (await setup.baseRewardPool.stakingToken()));

            //     console.log("tokenFactory token %s ", (await tokenFactory.token()));
            // });
            // it("Calls earmarkRewards with existing pool number", async () => {
            //     pid = 1;
            //     await setup.controller.connect(root).earmarkRewards(pid);

            //     expect(
            //     ).to.equal(true);
            // });
        });
    });
  });
});