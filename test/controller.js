const { expect } = require("chai");
const { ethers } = require("hardhat");
const { expectRevert } = require("@openzeppelin/test-helpers");

const init = require("./test-init.js");

const deploy = async () => {
  const setup = await init.initialize(await ethers.getSigners());

  setup.tokens = await init.getTokens(setup);
  
  setup.VoterProxy = await init.getVoterProxy(setup);

  setup.controller = await init.controller(setup);

  setup.baseRewardPool = await init.baseRewardPool(setup);

  setup.rewardFactory = await init.rewardFactory(setup);

  setup.proxyFactory = await init.proxyFactory(setup);

  setup.stashFactory = await init.stashFactory(setup);

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
  let lptoken;
  let gauge;
  let stashVersion;
  let balBal;

  //constants
  const zero_address = "0x0000000000000000000000000000000000000000";
  const FEE_DENOMINATOR = 10000;

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
    // TODO: for tests:
    //   await setup.controller.setOwner();
    //   await setup.controller.setPoolManager();
    //   await setup.controller.setArbitrator();
    //   await setup.controller.setVoteDelegate();
    //   await setup.controller.setRewardContracts();
    //   await setup.controller.setFeeInfo();
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
        //         console.log("feeToken %s ", (await setup.controller.feeToken()));

        //         expectRevert((await setup.controller.feeToken()).toString()).to.equal(zero_address);
        //     });
        // });
        context("» setFees testing", () => {
            it("Sets correct fees", async () => {
                await setup.controller
                        .connect(root)
                        .setFees(platformFee, profitFee);            
            });
            it("Should fail if total >MaxFees", async () => {
                platformFee = 1000;
                profitFee = 1001;
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
            it("Sets VoterProxy operator ", async () => {
                expect(await setup.VoterProxy.connect(root).setOperator(setup.controller.address));
            });
            it("Sets factories", async () => {
                rewardFactory = setup.rewardFactory;
                stashFactory = setup.stashFactory;
                tokenFactory = setup.tokens.TokenFactory;
                expect(await setup.controller.connect(root).setFactories(rewardFactory.address, stashFactory.address, tokenFactory.address));
            });
            it("Sets VoterProxy as StashFactory implementation ", async () => {
                expect(await setup.stashFactory.connect(root).setImplementation(setup.VoterProxy.address, setup.VoterProxy.address, setup.VoterProxy.address));
            });
            it("Adds pool", async () => {
                lptoken = setup.tokens.PoolContract;
                gauge = setup.tokens.GaugeController;
                stashVersion = 1;
                await setup.controller.connect(root).addPool(lptoken.address, gauge.address, stashVersion);
                expect(
                    (await setup.controller.poolLength()).toNumber()
                ).to.equal(1);
                const poolInfo = await setup.controller.poolInfo(0);
                expect(
                    (poolInfo.lptoken).toString()
                ).to.equal(lptoken.address.toString());
                expect(
                    (poolInfo.gauge).toString()
                ).to.equal(gauge.address.toString());
            });
            it("Sets RewardContracts", async () => {
                rewards = setup.rewardFactory;
                stakerRewards = setup.stashFactory;
                expect(await setup.controller.connect(root).setRewardContracts(rewards.address, stakerRewards.address));
            });
            it("Calls earmarkRewards with existing pool number", async () => {
                pid = 0;
                await setup.controller.connect(root).earmarkRewards(pid);
            });
            it("Checks feeManager balance", async () => {
                const feeManager = root.address;
                let balBal = await setup.tokens.WethBal.balanceOf(setup.controller.address);
                if (balBal.toNumber() > 0) {
                    let profitFees = await setup.controller.profitFees();
                    const profit = (balBal * profitFees) / FEE_DENOMINATOR;
                    balBal = balBal - profit;
                    let amount_expected = await setup.tokens.WethBal.balanceOf(feeManager).toNumber() - balBal;
                    expect(
                        (await setup.tokens.WethBal.balanceOf(feeManager)).toString()
                    ).to.equal(amount_expected.toString());
                } else {
                    let amount_expected = "20000000000000000000000";
                    expect(
                        (await setup.tokens.WethBal.balanceOf(feeManager)).toString()
                    ).to.equal(amount_expected); 
                }
            });
            
        });
    });
  });
});
