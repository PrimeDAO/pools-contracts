const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, expectRevert } = require("@openzeppelin/test-helpers");
const init = require("../test-init.js");

const deploy = async () => {
  const setup = await init.initialize(await ethers.getSigners());

  setup.tokens = await init.getTokens(setup);
  
  setup.VoterProxy = await init.getVoterProxy(setup);

  setup.controller = await init.controller(setup);

  setup.baseRewardPool = await init.baseRewardPool(setup);

  setup.rewardFactory = await init.rewardFactory(setup);

  setup.proxyFactory = await init.proxyFactory(setup);

  setup.stashFactory = await init.stashFactory(setup);

  setup.tokenFactory = await init.tokenFactory(setup);

  setup.extraRewardFactory = await init.getExtraRewardMock(setup);

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
  let feeManager;
  let treasury;
  let balRewards;

  //constants
  const zero_address = "0x0000000000000000000000000000000000000000";
  const FEE_DENOMINATOR = 10000;
  const lockTime = time.duration.days(365);
  const twentyMillion = 20000000;
  const thirtyMillion = 30000000;

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
    });

    context("» Testing changed functions", () => {
        context("» setFeeInfo testing", () => {
            it("Checks feeToken", async () => {
                expect((await setup.controller.feeToken()).toString()).to.equal(zero_address);

            });
        });
        context("» setFees testing", () => {
            it("Should fail if caller if not feeManager", async () => {
                await expectRevert(
                    setup.controller
                        .connect(staker)
                        .setFees(platformFee, profitFee),
                    "!auth"
                );      
            });
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
                tokenFactory = setup.tokenFactory;
                expect(await setup.controller.connect(root).setFactories(rewardFactory.address, stashFactory.address, tokenFactory.address));
            });
            it("Sets VoterProxy as StashFactory implementation ", async () => {
                expect(await setup.stashFactory.connect(root).setImplementation(setup.VoterProxy.address, setup.VoterProxy.address, setup.VoterProxy.address));
            });
            it("Adds pool", async () => { //now, because of gauge, stash is also = 0
                lptoken = setup.tokens.PoolContract;
                gauge = setup.tokens.GaugeController; //TODO: set gauge address, not gauge controller <-- need withdraw() (ICurveGauge(_gauge).withdraw(_amount);)
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
            it("Adds pool with stash = address(0)", async () => {
              lptoken = setup.tokens.PoolContract;
              gauge = setup.tokens.GaugeController;
              stashVersion = 0;

              await setup.controller.connect(root).addPool(lptoken.address, gauge.address, stashVersion);
              expect(
                  (await setup.controller.poolLength()).toNumber()
              ).to.equal(2);
              const poolInfo = await setup.controller.poolInfo(1);
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
            it("Change feeManager", async () => {
                expect(await setup.controller.connect(root).setFeeManager(reward_manager.address));
                expect(
                    (await setup.controller.feeManager()).toString()
                ).to.equal(reward_manager.address.toString());
            });            
            it("Add balance to feeManager", async () => { 
                feeManager = reward_manager;               
                balBal = await setup.tokens.WethBal.balanceOf(setup.controller.address);

                await setup.tokens.WethBal.transfer(feeManager.address, twentyMillion);

                expect(
                    (await setup.tokens.WethBal.balanceOf(feeManager.address)).toString()
                ).to.equal(twentyMillion.toString()); 
            });
            it("Add bal to Controller address", async () => {           
                expect(await setup.tokens.WethBal.transfer(setup.controller.address, thirtyMillion));
                expect(
                    (await setup.tokens.WethBal.balanceOf(setup.controller.address)).toString()
                ).to.equal(thirtyMillion.toString()); 
            });
            it("Calls earmarkRewards with existing pool number with non-empty balance", async () => {
                balBal = await setup.tokens.WethBal.balanceOf(setup.controller.address);
                let profitFees = await setup.controller.profitFees();
                const profit = (balBal * profitFees) / FEE_DENOMINATOR;
                balBal = balBal - profit; //balForTransfer if no treasury
                let amount_expected = (await setup.tokens.WethBal.balanceOf(feeManager.address)).toNumber() + profit;

                const poolInfo = await setup.controller.poolInfo(0);
                balRewards = (poolInfo.balRewards).toString();

                await setup.controller.connect(root).earmarkRewards(pid);

                expect(
                    (await setup.tokens.WethBal.balanceOf(feeManager.address)).toString()
                ).to.equal(amount_expected.toString());
                expect(
                    (await setup.tokens.WethBal.balanceOf(setup.controller.address)).toString()
                ).to.equal("0");
                expect(
                    (await setup.tokens.WethBal.balanceOf(balRewards)).toString()
                ).to.equal(balBal.toString());
            });
            it("Set treasury", async () => {
                treasury = admin;
                expect(await setup.controller.connect(feeManager).setTreasury(treasury.address));
                expect(
                    (await setup.controller.treasury()).toString()
                ).to.equal(admin.address.toString());
            });
            it("Calls earmarkRewards with existing pool number with non-empty balance and treasury", async () => {
                await setup.tokens.WethBal.transfer(setup.controller.address, thirtyMillion);

                balBal = await setup.tokens.WethBal.balanceOf(setup.controller.address);
                let profitFees = await setup.controller.profitFees();
                const profit = (balBal * profitFees) / FEE_DENOMINATOR;
                balBal = balBal - profit;
                let platformFees = await setup.controller.platformFees();
                const platform = (balBal * platformFees) / FEE_DENOMINATOR;
                rewardContract_amount_expected = balBal - platform;

                let treasury_amount_expected = (await setup.tokens.WethBal.balanceOf(treasury.address)).toNumber() + platform;
                let feeManager_amount_expected = (await setup.tokens.WethBal.balanceOf(feeManager.address)).toNumber() + profit;

                await setup.controller.connect(root).earmarkRewards(pid);

                expect(
                    (await setup.tokens.WethBal.balanceOf(feeManager.address)).toString()
                ).to.equal(feeManager_amount_expected.toString());
                expect(
                    (await setup.tokens.WethBal.balanceOf(treasury.address)).toString()
                ).to.equal(treasury_amount_expected.toString());
                expect(
                    (await setup.tokens.WethBal.balanceOf(setup.controller.address)).toString()
                ).to.equal("0");
            });
            it("Sets non-passing fees", async () => {
                await setup.controller
                        .connect(feeManager)
                        .setFees("0", profitFee);            
            });
            it("Calls earmarkRewardsc check 'send treasury' when platformFees = 0", async () => {
                balBal = await setup.tokens.WethBal.balanceOf(setup.controller.address);
                let profitFees = await setup.controller.profitFees();
                const profit = (balBal * profitFees) / FEE_DENOMINATOR;
                balBal = balBal - profit;
                let platformFees = await setup.controller.platformFees();
                const platform = (balBal * platformFees) / FEE_DENOMINATOR;
                rewardContract_amount_expected = balBal - platform;

                let treasury_amount_expected = (await setup.tokens.WethBal.balanceOf(treasury.address)).toNumber() + platform;

                await setup.controller.connect(root).earmarkRewards(pid);

                //expect 0 when platformFees = 0
                expect(
                    (await setup.tokens.WethBal.balanceOf(treasury.address)).toString()
                ).to.equal(treasury_amount_expected.toString());
            });            
            it("Sets correct fees back", async () => {
                await setup.controller
                        .connect(feeManager)
                        .setFees(platformFee, profitFee);            
            });
            it("Sets non-passing treasury", async () => {
                expect(await setup.controller.connect(feeManager).setTreasury(setup.controller.address));
                expect(
                    (await setup.controller.treasury()).toString()
                ).to.equal(setup.controller.address.toString());
            });
            it("Calls earmarkRewardsc check 'send treasury' when treasury = controller", async () => {
                balBal = await setup.tokens.WethBal.balanceOf(setup.controller.address);
                let profitFees = await setup.controller.profitFees();
                const profit = (balBal * profitFees) / FEE_DENOMINATOR;
                balBal = balBal - profit;
                let platformFees = await setup.controller.platformFees();
                const platform = (balBal * platformFees) / FEE_DENOMINATOR;
                rewardContract_amount_expected = balBal - platform;

                let treasury_amount_expected = (await setup.tokens.WethBal.balanceOf(treasury.address)).toNumber() + platform;

                await setup.controller.connect(root).earmarkRewards(pid);

                //expect 0 when platformFees = 0
                expect(
                    (await setup.tokens.WethBal.balanceOf(treasury.address)).toString()
                ).to.equal(treasury_amount_expected.toString());
            });  
            it("Sets correct treasury back", async () => {
                expect(await setup.controller.connect(feeManager).setTreasury(treasury.address));
                expect(
                    (await setup.controller.treasury()).toString()
                ).to.equal(admin.address.toString());
            });           
        });
        context("» earmarkFees testing", () => {
            it("Calls earmarkFees", async () => {

            });
        });
        context("» deposit testing", () => {
            it("It deposit lp tokens from operator stake = true", async () => {
              await setup.tokens.WethBal.transfer(staker.address, twentyMillion);
              const stake = true;

              expect(await setup.controller.connect(operator).deposit(pid, twentyMillion, stake));

              let timelock = ((await time.latest()).add(lockTime)).toNumber();

              expect(
                (await setup.controller.userLockTime(operator.address)).toNumber()
              ).to.equal(timelock);
            });
            it("It deposit lp tokens stake = true", async () => {
              await setup.tokens.WethBal.transfer(staker.address, twentyMillion);
              const stake = true;

              expect(await setup.controller.connect(staker).deposit(pid, twentyMillion, stake));
              let timelock = ((await time.latest()).add(lockTime)).toNumber();

              expect(
                (await setup.controller.userLockTime(staker.address)).toNumber()
              ).to.equal(timelock);
            });

            it("It deposit lp tokens stake = false", async () => {
              await setup.tokens.WethBal.transfer(staker.address, twentyMillion);
              const stake = false;
              expect(await setup.controller.connect(staker).deposit(pid, twentyMillion, stake));



            });
        });        

        context("» withdrawUnlockedVeBal testing", () => {
            it("It fails withdraw Unlocked VeBal until userLockTime is not reached", async () => {
              await expectRevert(
                setup.controller
                    .connect(staker)
                    .withdrawUnlockedVeBal(pid, twentyMillion),
                "Controller: userLockTime is not reached yet"
              );
            });
            it("Sets VoterProxy depositor", async () => {
              expect(await setup.VoterProxy.connect(root).setDepositor(root.address));
            });
            it("It increaseAmount veBal", async () => {
              expect(await setup.VoterProxy.connect(root).increaseAmount(thirtyMillion));
            });            
            it("It fails withdraw Unlocked VeBal until userLockTime is not reached", async () => {
              await expectRevert(
                setup.controller
                    .connect(staker)
                    .withdrawUnlockedVeBal(pid, twentyMillion),
                "Controller: userLockTime is not reached yet"
              );
            });

            it("It withdraw Unlocked VeBal", async () => {
              time.increase(lockTime);
              console.log("controller before is %s", (await setup.tokens.VeBal.NbalanceOf(setup.controller.address)).toNumber());
              console.log("treasury before is %s", (await setup.tokens.VeBal.NbalanceOf(treasury.address)).toNumber());
              let treasury_amount_expected = (await setup.tokens.VeBal.NbalanceOf(treasury.address)).add(twentyMillion);
              console.log("expected is %s", treasury_amount_expected.toNumber());
              
              expect(await setup.controller.connect(staker).withdrawUnlockedVeBal(pid, twentyMillion));

              expect(
                (await setup.tokens.VeBal.NbalanceOf(treasury.address)).toString()
              ).to.equal(treasury_amount_expected.toString());
            });
        });
        context("» restake testing", () => {
            it("Sets VoterProxy depositor", async () => {
              expect(await setup.VoterProxy.connect(root).setDepositor(setup.controller.address));
            });
            it("It redeposit tokens", async () => {
              time.increase(lockTime);

              expect(await setup.controller.connect(staker).restake(pid));
              let timelock = ((await time.latest()).add(lockTime)).toNumber();
              expect(
                (await setup.controller.userLockTime(staker.address)).toNumber()
              ).to.equal(timelock);
            });
            it("It fails redeposit tokens until userLockTime is not reached", async () => {
              await expectRevert(
                setup.controller
                    .connect(staker)
                    .restake(pid),
                "Controller: can't restake. userLockTime is not reached yet"
              );
            });            
            it("It redeposit tokens when stash = address(0)", async () => {
              time.increase(lockTime);
              const pidStashZero = 1;

              expect(await setup.controller.connect(staker).restake(pidStashZero));
              let timelock = ((await time.latest()).add(lockTime)).toNumber();
              expect(
                (await setup.controller.userLockTime(staker.address)).toNumber()
              ).to.equal(timelock);
            });
            it("It fails redeposit tokens when pool is closed", async () => {
              expect(await setup.controller.connect(root).shutdownPool(pid));

              await expectRevert(
                setup.controller
                    .connect(staker)
                    .restake(pid),
                "pool is closed"
              );
            });
            it("It fails redeposit tokens when shutdownSystem", async () => {
              expect(await setup.controller.connect(root).shutdownSystem());

              await expectRevert(
                setup.controller
                    .connect(staker)
                    .restake(pid),
                "shutdown"
              );
            });

        });
    });
  });
});
