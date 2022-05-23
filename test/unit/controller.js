const { expect } = require("chai");
const { deployments, ethers } = require("hardhat");
const { BigNumber, constants } = require("ethers");
const { time, expectRevert, BN } = require("@openzeppelin/test-helpers");
const init = require("../test-init.js");

const deploy = async () => {
  const setup = await init.initialize(await ethers.getSigners());

  setup.tokens = await init.getTokens(setup);
  
  setup.VoterProxy = await init.getVoterProxy(setup);

  setup.VoterProxyMockFactory = await init.getVoterProxyMock(setup);

  setup.controller = await init.controller(setup);

  setup.baseRewardPool = await init.baseRewardPool(setup);

  setup.rewardFactory = await init.rewardFactory(setup);

  setup.proxyFactory = await init.proxyFactory(setup);

  setup.stashFactory = await init.stashFactory(setup);

  setup.stashFactoryMock = await init.getStashFactoryMock(setup);

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
  const halfAYear = lockTime / 2;
  const smallLockTime = time.duration.days(30);
  const doubleSmallLockTime = time.duration.days(60);
  const tenMillion = 30000;//000;
  const twentyMillion = 20000;//000;
  const thirtyMillion = 30000;//000;
  const sixtyMillion = 60000;//000;
  const defaultTimeForBalanceOfVeBal = 0;
  const difference = new BN(28944000); // 1684568938 - 1655624938
  const timeDifference = BigNumber.from(difference.toString());

  context("» Controller", () => {
    
    before("setup", async () => {
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

      expect(await setup.controller.poolLength()).to.equal(0)

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

                await setup.controller.connect(root).addPool(lptoken.address, gauge.address, stashVersion); //need for restake test below
            });
            it("Adds pool with stash != address(0)", async () => {
              expect(await setup.controller.connect(root).setFactories(rewardFactory.address, setup.stashFactoryMock.address, tokenFactory.address));
              await setup.controller.connect(root).addPool(lptoken.address, gauge.address, stashVersion);
              expect(
                (await setup.controller.poolLength()).toNumber()
              ).to.equal(3);
              expect(await setup.controller.connect(root).setFactories(rewardFactory.address, stashFactory.address, tokenFactory.address));
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

              const BNtimelock = ethers.BigNumber.from(((await time.latest()).add(smallLockTime)).toString());
              const timelock = ethers.BigNumber.from(BNtimelock.add(timeDifference));

              expect(
                (await setup.controller.userLockTime(operator.address)).toNumber()
              ).to.equal(timelock);
            });
            it("It deposit lp tokens stake = true", async () => {
              await setup.tokens.WethBal.transfer(staker.address, twentyMillion);
              const stake = true;

              expect(await setup.controller.connect(staker).deposit(pid, twentyMillion, stake));
              const BNtimelock = ethers.BigNumber.from(((await time.latest()).add(smallLockTime)).toString());
              const timelock = ethers.BigNumber.from(BNtimelock.add(timeDifference));
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
            it("It configure settings veBal and VoterProxy", async () => {
              expect(await setup.tokens.VeBal.connect(authorizer_adaptor).commit_smart_wallet_checker(setup.VoterProxy.address));
              expect(await setup.tokens.VeBal.connect(authorizer_adaptor).apply_smart_wallet_checker());
              
              expect(await setup.tokens.WethBal.mint(setup.tokens.VeBal.address, thirtyMillion)); // edited so thirtyMillion= 30000;//000;
              expect(await setup.tokens.WethBal.mint(setup.VoterProxy.address, sixtyMillion));


              let unlockTime = ((await time.latest()).add(doubleSmallLockTime)).toNumber();
              expect(await setup.VoterProxy.connect(root).createLock(tenMillion, unlockTime));
            });
            it("It increaseAmount veBal", async () => {
              expect(await setup.VoterProxy.connect(root).increaseAmount(thirtyMillion));     
              const f = await setup.tokens.VeBal.connect(root).NbalanceOf(setup.VoterProxy.address, 0);
            });            
            it("It fails withdraw Unlocked VeBal until userLockTime is not reached", async () => {
              time.increase(new BN(31249454));
// const f = await setup.tokens.VeBal.connect(root).NbalanceOf(setup.VoterProxy.address, 0);
              await expectRevert(
                setup.controller
                    .connect(staker)
                    .withdrawUnlockedVeBal(pid, tenMillion),
                "Controller: userLockTime is not reached yet"
              );
            });

            it("It withdraw Unlocked VeBal", async () => {
              // time.increase(halfAYear);//
              time.increase(smallLockTime.add(difference));
              const f = await setup.tokens.VeBal.connect(root).NbalanceOf(setup.VoterProxy.address, 0);
              let treasury_amount_expected = (await setup.tokens.VeBal.NbalanceOf(treasury.address, 0)).add(twentyMillion);
              let unitTest_treasury_amount_expected = 0;
              expect(await setup.controller.connect(staker).withdrawUnlockedVeBal(pid, tenMillion));
              expect(
                (await setup.tokens.VeBal.NbalanceOf(treasury.address, 0)).toString()
              ).to.equal(unitTest_treasury_amount_expected.toString());
            });

            it("It withdraw Unlocked VeBal when pool is closed", async () => {
              const alternativeSetup = await deploy();

              await alternativeSetup.VoterProxy.connect(root).setOperator(setup.controller.address);
              const rewardFactory = alternativeSetup.rewardFactory;
              const stashFactory = alternativeSetup.stashFactory;
              const tokenFactory = alternativeSetup.tokenFactory;
              await alternativeSetup.controller.connect(root).setFactories(rewardFactory.address, stashFactory.address, tokenFactory.address);
              await alternativeSetup.stashFactory.connect(root).setImplementation(alternativeSetup.VoterProxy.address, alternativeSetup.VoterProxy.address, alternativeSetup.VoterProxy.address);
              await alternativeSetup.VoterProxy.connect(root).setDepositor(root.address);

              await alternativeSetup.controller.connect(root).addPool(lptoken.address, gauge.address, stashVersion);              
              await alternativeSetup.tokens.WethBal.transfer(staker.address, twentyMillion);

              let unlockTime = ((await time.latest()).add(doubleSmallLockTime)).toNumber();
              await alternativeSetup.tokens.VeBal.connect(authorizer_adaptor).commit_smart_wallet_checker(alternativeSetup.VoterProxy.address);
              await alternativeSetup.tokens.VeBal.connect(authorizer_adaptor).apply_smart_wallet_checker();

              await alternativeSetup.tokens.WethBal.mint(alternativeSetup.tokens.VeBal.address, thirtyMillion); // edited so thirtyMillion= 30000;//000;
              await alternativeSetup.tokens.WethBal.mint(alternativeSetup.VoterProxy.address, sixtyMillion);

              await alternativeSetup.VoterProxy.connect(root).createLock(tenMillion, unlockTime);              
              await alternativeSetup.VoterProxy.connect(root).increaseAmount(thirtyMillion);     

              const stake = false;
              const pid = 0;

              time.increase(smallLockTime.add(difference));

              expect(await alternativeSetup.controller.connect(root).shutdownPool(pid));
              expect(await alternativeSetup.controller.connect(staker).withdrawUnlockedVeBal(pid, twentyMillion));
            });
        });
        context("» restake testing", () => {       
            // it("Sets VoterProxy depositor", async () => {
            //     await setup.tokens.WethBal.transfer(staker.address, twentyMillion);
            //     const stake = true;
            //     pid = 2;

            //     // expect(await setup.VoterProxy.connect(root).setDepositor(setup.controller.address));

            //     expect(await setup.controller.connect(operator).deposit(pid, twentyMillion, stake));
  
            //     const BNtimelock = ethers.BigNumber.from(((await time.latest()).add(smallLockTime)).toString());
            //     const timelock = ethers.BigNumber.from(BNtimelock.add(timeDifference));
  
            //     expect(
            //       (await setup.controller.userLockTime(operator.address)).toNumber()
            //     ).to.equal(timelock);

            // });
            // it("It fails redeposit tokens when Lock expired", async () => {
            //   await expectRevert(
            //     setup.controller
            //         .connect(root)
            //         .restake(pid),
            //     "Lock expired"
            //   ); 
            // });
            it("It redeposit tokens", async () => {
              // time.increase(smallLockTime.add(difference));
              // const pid = 2;      
              expect(await setup.VoterProxy.connect(root).setDepositor(setup.controller.address));
              const BNtimelock = ethers.BigNumber.from(((await time.latest()).add(doubleSmallLockTime)).toString());
              const timelock = ethers.BigNumber.from(BNtimelock.add(timeDifference));

              expect(await setup.VoterProxy.connect(root).createLock(tenMillion, BNtimelock));
              expect(await setup.VoterProxy.connect(root).setDepositor(setup.controller.address));

              expect(await setup.controller.connect(root).restake(pid));

              // const BNtimelock = ethers.BigNumber.from(((await time.latest()).add(smallLockTime)).toString());
              // const timelock = ethers.BigNumber.from(BNtimelock.add(timeDifference));


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
              time.increase(smallLockTime.add(difference));
              const pidStashZero = 0;//1;

              expect(await setup.controller.connect(staker).restake(pidStashZero));
              const BNtimelock = ethers.BigNumber.from(((await time.latest()).add(smallLockTime)).toString());
              const timelock = ethers.BigNumber.from(BNtimelock.add(timeDifference));
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
