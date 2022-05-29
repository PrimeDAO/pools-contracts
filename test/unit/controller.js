const { expect } = require("chai");
const { BigNumber, constants } = require("ethers");
const { deployments, ethers } = require("hardhat");
const { time, expectRevert, BN } = require("@openzeppelin/test-helpers");
const init = require("../test-init.js");

//constants
const zero_address = "0x0000000000000000000000000000000000000000";
const FEE_DENOMINATOR = 10000;
const lockTime = time.duration.days(365);
const halfAYear = lockTime / 2;
const smallLockTime = time.duration.days(30);
const doubleSmallLockTime = time.duration.days(60);
const tenMillion = 30000000;
const twentyMillion = 20000000;
const thirtyMillion = 30000000;
const sixtyMillion = 60000000;
const defaultTimeForBalanceOfVeBal = 0;
const difference = new BN(28944000); // 1684568938 - 1655624938 
const timeDifference = BigNumber.from(difference.toString());

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
let wethBalBal;
let feeManager;
let treasury;

describe("Controller", function () {

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        const signers = await ethers.getSigners();
        const setup = await init.initialize(await ethers.getSigners());

        const tokens = await init.getTokens(setup);

        setup.GaugeController = await init.gaugeController(setup);

        setup.VoterProxy = await init.getVoterProxyMock(setup);//getVoterProxy(setup);
      
        setup.controller = await init.controller(setup);
      
        setup.baseRewardPool = await init.baseRewardPool(setup);
      
        setup.rewardFactory = await init.rewardFactory(setup);
      
        setup.proxyFactory = await init.proxyFactory(setup);
      
        setup.stashFactory = await init.stashFactory(setup);
      
        setup.stashFactoryMock = await init.getStashFactoryMock(setup);
      
        setup.tokenFactory = await init.tokenFactory(setup);
      
        setup.extraRewardFactory = await init.getExtraRewardMock(setup);
      
        platformFee = 500;
        profitFee = 100;

        return {
            tokens,
            GaugeController: setup.GaugeController,
            VoterProxy: setup.VoterProxy,
            controller: setup.controller,
            rewardFactory: setup.rewardFactory,
            proxyFactory: setup.proxyFactory,
            stashFactory: setup.stashFactory ,
            tokenFactory: setup.tokenFactory,
            stashFactoryMock : setup.stashFactoryMock,
            root: setup.roles.root,
            staker: setup.roles.staker,
            admin: setup.roles.prime,
            reward_manager: setup.roles.reward_manager,
            authorizer_adaptor: setup.roles.authorizer_adaptor,
            operator: setup.roles.operator,
            randomUser: signers.pop(),
        }
    });
    const setupTests2 = deployments.createFixture(async ({ deployments }) => {
        const signers = await ethers.getSigners();
        const setup = await init.initialize(await ethers.getSigners());

        const tokens = await init.getTokens(setup);

        setup.GaugeController = await init.gaugeController(setup);

        setup.VoterProxy = await init.getVoterProxyMock(setup);//getVoterProxy(setup);
      
        setup.controller = await init.controller(setup);
      
        setup.baseRewardPool = await init.baseRewardPool(setup);
      
        setup.rewardFactory = await init.rewardFactory(setup);
      
        setup.proxyFactory = await init.proxyFactory(setup);
      
        setup.stashFactory = await init.stashFactory(setup);
      
        setup.stashFactoryMock = await init.getStashFactoryMock(setup);
      
        setup.tokenFactory = await init.tokenFactory(setup);
      
        setup.extraRewardFactory = await init.getExtraRewardMock(setup);
      
        platformFee = 500;
        profitFee = 100;

        expect(await setup.VoterProxy.connect(setup.roles.root).setOperator(setup.controller.address));
        expect(await setup.controller.connect(setup.roles.root).setFactories(setup.rewardFactory.address, setup.stashFactory.address, setup.tokenFactory.address));
        // Deploy implementation contract
        const implementationAddress = await ethers.getContractFactory('StashMock')
            .then(x => x.deploy())
            .then(x => x.address)  
        // Set implementation contract
        await expect(setup.stashFactory.connect(setup.roles.root).setImplementation(implementationAddress))
            .to.emit(setup.stashFactory, 'ImpelemntationChanged')
            .withArgs(implementationAddress);

        lptoken = tokens.PoolContract;
        gauge = setup.GaugeController;
        expect(await setup.controller.connect(setup.roles.root).addPool(lptoken.address, gauge.address));

        rewards = setup.rewardFactory;
        stakerRewards = setup.stashFactory;
        expect(await setup.controller.connect(setup.roles.root).setRewardContracts(rewards.address, stakerRewards.address)); 

        return {
            tokens,
            GaugeController: setup.GaugeController,
            VoterProxy: setup.VoterProxy,
            controller: setup.controller,
            rewardFactory: setup.rewardFactory,
            proxyFactory: setup.proxyFactory,
            stashFactory: setup.stashFactory ,
            tokenFactory: setup.tokenFactory,
            stashFactoryMock : setup.stashFactoryMock,
            root: setup.roles.root,
            staker: setup.roles.staker,
            admin: setup.roles.prime,
            reward_manager: setup.roles.reward_manager,
            authorizer_adaptor: setup.roles.authorizer_adaptor,
            operator: setup.roles.operator,
            randomUser: signers.pop(),
        }
    });
    // before('setup', async function() {
    //     const { VoterProxy, controller, rewardFactory, stashFactory, tokenFactory, GaugeController, tokens, root } = await setupTests();
    //     expect(await VoterProxy.connect(root).setOperator(controller.address));
    //     expect(await controller.connect(root).setFactories(rewardFactory.address, stashFactory.address, tokenFactory.address));
    //     // Deploy implementation contract
    //     const implementationAddress = await ethers.getContractFactory('StashMock')
    //         .then(x => x.deploy())
    //         .then(x => x.address)  
    //     // Set implementation contract
    //     await expect(stashFactory.connect(root).setImplementation(implementationAddress))
    //         .to.emit(stashFactory, 'ImpelemntationChanged')
    //         .withArgs(implementationAddress);

    //     lptoken = tokens.PoolContract;
    //     gauge = GaugeController;
    //     expect(await controller.connect(root).addPool(lptoken.address, gauge.address));

    //     rewards = rewardFactory;
    //     stakerRewards = stashFactory;
    //     expect(await controller.connect(root).setRewardContracts(rewards.address, stakerRewards.address));    
    // })

    context("» setFeeInfo testing", () => {
        it("Checks feeToken", async () => {
            const { controller } = await setupTests();
            expect((await controller.feeToken()).toString()).to.equal(zero_address);
        });
    });
    context("» setFees testing", () => {
        it("Should fail if caller if not feeManager", async () => {
            const { controller, staker } = await setupTests();
            await expectRevert(
                controller
                    .connect(staker)
                    .setFees(platformFee, profitFee),
                "!auth"
            );      
        });
        it("Sets correct fees", async () => {
            const { controller, root } = await setupTests();
            await controller
                    .connect(root)
                    .setFees(platformFee, profitFee);            
        });
        it("Should fail if total >MaxFees", async () => {
            const { controller, root } = await setupTests();
            platformFee = 1000;
            profitFee = 1001;
            await expectRevert(
                controller
                    .connect(root)
                    .setFees(platformFee, profitFee),
                ">MaxFees"
            );                
        });
        it("Should fail if platformFee is too small", async () => {
            const { controller, root } = await setupTests();
            platformFee = 400;
            profitFee = 100;
            await controller
                    .connect(root)
                    .setFees(platformFee, profitFee);
            expect((await controller.platformFees()).toString()).to.equal("1000");              
        });
        it("Should fail if platformFee is too big", async () => {
            const { controller, root } = await setupTests();
            platformFee = 10000;
            profitFee = 100;
            await expectRevert(
                controller
                    .connect(root)
                    .setFees(platformFee, profitFee),
                ">MaxFees"
            );  
        });
        it("Should fail if profitFee is too small", async () => {
            const { controller, root } = await setupTests();
            platformFee = 500;
            profitFee = 10;
            await controller
                    .connect(root)
                    .setFees(platformFee, profitFee);
            expect((await controller.profitFees()).toString()).to.equal("250"); //default value in Controller contract

        });
        it("Should fail if profitFee is too big", async () => {
            const { controller, root } = await setupTests();
            platformFee = 500;
            profitFee = 1000;
            await controller
                    .connect(root)
                    .setFees(platformFee, profitFee);
            expect((await controller.profitFees()).toString()).to.equal("250");

        });
    });
        context("» _earmarkRewards testing", () => {
            // before('>>> setup', async function() {
            //     const { VoterProxy, controller, rewardFactory, stashFactory, tokenFactory, GaugeController, root } = await setupTests();
            //     expect(await VoterProxy.connect(root).setOperator(controller.address));
            //     expect(await controller.connect(root).setFactories(rewardFactory.address, stashFactory.address, tokenFactory.address));
            // })
            it("Calls earmarkRewards with non existing pool number", async () => {
                const { controller, root } = await setupTests();
                pid = 1;
                await expectRevert(
                    controller
                        .connect(root)
                        .earmarkRewards(pid),
                    "Controller: pool is not exists"
                );  
            });
            // it("Sets VoterProxy operator ", async () => {
            //     const { VoterProxy, controller, root } = await setupTests();
            //     expect(await VoterProxy.connect(root).setOperator(controller.address));
            // });
            // it("Sets factories", async () => {
            //     const { VoterProxy, controller, rewardFactory, stashFactory, tokenFactory, root } = await setupTests();

            //     // rewardFactory = setup.rewardFactory;
            //     // stashFactory = setup.stashFactory;
            //     // tokenFactory = setup.tokenFactory;
            //     expect(await controller.connect(root).setFactories(rewardFactory.address, stashFactory.address, tokenFactory.address));
            // });
            it("Sets StashFactory implementation ", async () => {
                const { VoterProxy, controller, rewardFactory, stashFactory, tokenFactory, root } = await setupTests();

                // Deploy implementation contract
                const implementationAddress = await ethers.getContractFactory('StashMock')
                    .then(x => x.deploy())
                    .then(x => x.address)
            
                // Set implementation contract
                await expect(stashFactory.connect(root).setImplementation(implementationAddress))
                    .to.emit(stashFactory, 'ImpelemntationChanged')
                    .withArgs(implementationAddress);
            });
            it("Adds pool", async () => { //now, because of gauge, stash is also = 0
                const { VoterProxy, controller, rewardFactory, stashFactory, tokenFactory, GaugeController, tokens, root } = await setupTests();
                expect(await VoterProxy.connect(root).setOperator(controller.address));
                expect(await controller.connect(root).setFactories(rewardFactory.address, stashFactory.address, tokenFactory.address));

                lptoken = tokens.PoolContract;
                gauge = GaugeController;
                stashVersion = 1;

                await controller.connect(root).addPool(lptoken.address, gauge.address);
                expect(
                    (await controller.poolLength()).toNumber()
                ).to.equal(1);
                const poolInfo = await controller.poolInfo(0);
                expect(
                    (poolInfo.lptoken).toString()
                ).to.equal(lptoken.address.toString());
                expect(
                    (poolInfo.gauge).toString()
                ).to.equal(gauge.address.toString());

                await controller.connect(root).addPool(lptoken.address, gauge.address); //need for restake test below
            });
            it("Adds pool with stash != address(0)", async () => {
              const { VoterProxy, controller, rewardFactory, stashFactory, tokenFactory, GaugeController, stashFactoryMock, root } = await setupTests();
              expect(await VoterProxy.connect(root).setOperator(controller.address));
              expect(await controller.connect(root).setFactories(rewardFactory.address, stashFactory.address, tokenFactory.address));

              expect(await controller.connect(root).setFactories(rewardFactory.address, stashFactoryMock.address, tokenFactory.address));
              await controller.connect(root).addPool(lptoken.address, gauge.address);
              expect(
                (await controller.poolLength()).toNumber()
              ).to.equal(1);
              expect(await controller.connect(root).setFactories(rewardFactory.address, stashFactory.address, tokenFactory.address));
            });
            it("Sets RewardContracts", async () => {
                const { controller, rewardFactory, stashFactory, root } = await setupTests();
                rewards = rewardFactory;
                stakerRewards = stashFactory;
                expect(await controller.connect(root).setRewardContracts(rewards.address, stakerRewards.address));
            });
            it("Calls earmarkRewards with existing pool number", async () => {
                const { VoterProxy, controller, rewardFactory, stashFactory, tokenFactory, GaugeController, tokens, root } = await setupTests2();
                // expect(await VoterProxy.connect(root).setOperator(controller.address));
                // expect(await controller.connect(root).setFactories(rewardFactory.address, stashFactory.address, tokenFactory.address));
                // // Deploy implementation contract
                // const implementationAddress = await ethers.getContractFactory('StashMock')
                //     .then(x => x.deploy())
                //     .then(x => x.address)  
                // // Set implementation contract
                // await expect(stashFactory.connect(root).setImplementation(implementationAddress))
                //     .to.emit(stashFactory, 'ImpelemntationChanged')
                //     .withArgs(implementationAddress);

                // lptoken = tokens.PoolContract;
                // gauge = GaugeController;
                // await controller.connect(root).addPool(lptoken.address, gauge.address);
                // rewards = rewardFactory;
                // stakerRewards = stashFactory;
                // expect(await controller.connect(root).setRewardContracts(rewards.address, stakerRewards.address));

                pid = 0;
                await controller.connect(root).earmarkRewards(pid);
            });
            it("Change feeManager", async () => {
                const { controller, reward_manager, root } = await setupTests();
                expect(await controller.connect(root).setFeeManager(reward_manager.address));
                expect(
                    (await controller.feeManager()).toString()
                ).to.equal(reward_manager.address.toString());
            });            
            it("Add balance to feeManager", async () => { 
                const { controller, tokens, reward_manager } = await setupTests();
                feeManager = reward_manager;               
                wethBalBal = await tokens.WethBal.balanceOf(controller.address);

                await tokens.WethBal.transfer(feeManager.address, twentyMillion);

                expect(
                    (await tokens.WethBal.balanceOf(feeManager.address)).toString()
                ).to.equal(twentyMillion.toString()); 
            });
            it("Add bal to Controller address", async () => {           
                const { controller, tokens } = await setupTests();

                expect(await tokens.WethBal.transfer(controller.address, thirtyMillion));
                expect(
                    (await tokens.WethBal.balanceOf(controller.address)).toString()
                ).to.equal(thirtyMillion.toString()); 
            });
            it("Calls earmarkRewards with existing pool number with non-empty balance", async () => {
                const { controller, tokens, reward_manager, root } = await setupTests();

                wethBalBal = await tokens.WethBal.balanceOf(controller.address);
                let profitFees = await controller.profitFees();
                const profit = (wethBalBal * profitFees) / FEE_DENOMINATOR;
                wethBalBal = wethBalBal - profit; //balForTransfer if no treasury
                let amount_expected = (await tokens.WethBal.balanceOf(feeManager.address)).toNumber() + profit;

                const poolInfo = await controller.poolInfo(0);
                balRewards = (poolInfo.balRewards).toString();

                await controller.connect(root).earmarkRewards(pid);

                expect(
                    (await tokens.WethBal.balanceOf(feeManager.address)).toString()
                ).to.equal(amount_expected.toString());
                expect(
                    (await tokens.WethBal.balanceOf(controller.address)).toString()
                ).to.equal("0");
                expect(
                    (await tokens.WethBal.balanceOf(balRewards)).toString()
                ).to.equal(wethBalBal.toString());
            });
            it("Set treasury", async () => {
                const { controller, tokens, admin, root } = await setupTests();

                treasury = admin;
                expect(await controller.connect(feeManager).setTreasury(treasury.address));
                expect(
                    (await controller.treasury()).toString()
                ).to.equal(admin.address.toString());
            });
            it("Calls earmarkRewards with existing pool number with non-empty balance and treasury", async () => {
                await setup.tokens.WethBal.transfer(setup.controller.address, thirtyMillion);

                wethBalBal = await setup.tokens.WethBal.balanceOf(setup.controller.address);
                let profitFees = await setup.controller.profitFees();
                const profit = (wethBalBal * profitFees) / FEE_DENOMINATOR;
                wethBalBal = wethBalBal - profit;
                let platformFees = await setup.controller.platformFees();
                const platform = (wethBalBal * platformFees) / FEE_DENOMINATOR;
                rewardContract_amount_expected = wethBalBal - platform;

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
                wethBalBal = await setup.tokens.WethBal.balanceOf(setup.controller.address);
                let profitFees = await setup.controller.profitFees();
                const profit = (wethBalBal * profitFees) / FEE_DENOMINATOR;
                wethBalBal = wethBalBal - profit;
                let platformFees = await setup.controller.platformFees();
                const platform = (wethBalBal * platformFees) / FEE_DENOMINATOR;
                rewardContract_amount_expected = wethBalBal - platform;

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
                wethBalBal = await setup.tokens.WethBal.balanceOf(setup.controller.address);
                let profitFees = await setup.controller.profitFees();
                const profit = (wethBalBal * profitFees) / FEE_DENOMINATOR;
                wethBalBal = wethBalBal - profit;
                let platformFees = await setup.controller.platformFees();
                const platform = (wethBalBal * platformFees) / FEE_DENOMINATOR;
                rewardContract_amount_expected = wethBalBal - platform;

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
        // context("» earmarkFees testing", () => {
        //     it("Calls earmarkFees", async () => {

        //     });
        // });
        // context("» deposit testing", () => {
        //     it("It deposit lp tokens from operator stake = true", async () => {
        //       await setup.tokens.WethBal.transfer(staker.address, twentyMillion);
        //       const stake = true;

        //       expect(await setup.controller.connect(operator).deposit(pid, twentyMillion, stake));
        //     });
        //     it("It deposit lp tokens stake = true", async () => {
        //       await setup.tokens.WethBal.transfer(staker.address, twentyMillion);
        //       const stake = true;

        //       expect(await setup.controller.connect(staker).deposit(pid, twentyMillion, stake));
        //     });

        //     it("It deposit lp tokens stake = false", async () => {
        //       await setup.tokens.WethBal.transfer(staker.address, twentyMillion);
        //       const stake = false;
        //       expect(await setup.controller.connect(staker).deposit(pid, twentyMillion, stake));
        //     });
        // });        

        // context("» withdrawUnlockedWethBal testing", () => {
        //     it("Sets VoterProxy depositor", async () => {
        //       expect(await setup.VoterProxy.connect(root).setDepositor(root.address));
        //     });
        //     it("It configure settings WethBal and VoterProxy", async () => {
        //       expect(await setup.tokens.VeBal.connect(authorizer_adaptor).commit_smart_wallet_checker(setup.VoterProxy.address));
        //       expect(await setup.tokens.VeBal.connect(authorizer_adaptor).apply_smart_wallet_checker());
              
        //       expect(await setup.tokens.WethBal.mint(setup.tokens.VeBal.address, thirtyMillion));
        //       expect(await setup.tokens.WethBal.mint(setup.VoterProxy.address, sixtyMillion));


        //       let unlockTime = ((await time.latest()).add(doubleSmallLockTime)).toNumber();
        //       expect(await setup.VoterProxy.connect(root).createLock(tenMillion, unlockTime));
        //     });
        //     it("It increaseAmount WethBal", async () => {
        //       expect(await setup.VoterProxy.connect(root).increaseAmount(thirtyMillion));     
        //       let tx = await setup.tokens.VeBal["balanceOf(address,uint256)"](setup.VoterProxy.address, 0);
        //     });
        //     it("It withdraw Unlocked WethBal", async () => {
        //       time.increase(smallLockTime.add(difference));
        //       const f = await setup.tokens.VeBal["balanceOf(address,uint256)"](setup.VoterProxy.address, 0);
        //       let treasury_amount_expected = (await setup.tokens.VeBal["balanceOf(address,uint256)"](treasury.address, 0)).add(twentyMillion);
        //       let unitTest_treasury_amount_expected = 0;
        //       expect(await setup.controller.connect(staker).withdrawUnlockedWethBal(pid, tenMillion));
        //       expect(
        //         (await setup.tokens.VeBal["balanceOf(address,uint256)"](treasury.address, 0)).toString()
        //       ).to.equal(unitTest_treasury_amount_expected.toString());
        //     });

        //     it("It withdraw Unlocked WethBal when pool is closed", async () => {
        //       const alternativeSetup = await deploy();

        //       await alternativeSetup.VoterProxy.connect(root).setOperator(setup.controller.address);
        //       const rewardFactory = alternativeSetup.rewardFactory;
        //       const stashFactory = alternativeSetup.stashFactory;
        //       const tokenFactory = alternativeSetup.tokenFactory;
        //       await alternativeSetup.controller.connect(root).setFactories(rewardFactory.address, stashFactory.address, tokenFactory.address);
        //       // Deploy implementation contract
        //       const implementationAddress = await ethers.getContractFactory('StashMock')
        //         .then(x => x.deploy())
        //         .then(x => x.address)                      
        //       // Set implementation contract
        //       await expect(stashFactory.connect(root).setImplementation(implementationAddress))
        //         .to.emit(stashFactory, 'ImpelemntationChanged')
        //         .withArgs(implementationAddress);
        //       await alternativeSetup.VoterProxy.connect(root).setDepositor(root.address);

        //       await alternativeSetup.controller.connect(root).addPool(lptoken.address, gauge.address);              
        //       await alternativeSetup.tokens.WethBal.transfer(staker.address, twentyMillion);

        //       let unlockTime = ((await time.latest()).add(doubleSmallLockTime)).toNumber();
        //       await alternativeSetup.tokens.VeBal.connect(authorizer_adaptor).commit_smart_wallet_checker(alternativeSetup.VoterProxy.address);
        //       await alternativeSetup.tokens.VeBal.connect(authorizer_adaptor).apply_smart_wallet_checker();

        //       await alternativeSetup.tokens.WethBal.mint(alternativeSetup.tokens.VeBal.address, thirtyMillion);
        //       await alternativeSetup.tokens.WethBal.mint(alternativeSetup.VoterProxy.address, sixtyMillion);

        //       await alternativeSetup.VoterProxy.connect(root).createLock(tenMillion, unlockTime);              
        //       await alternativeSetup.VoterProxy.connect(root).increaseAmount(thirtyMillion);     

        //       const stake = false;
        //       const pid = 0;

        //       time.increase(smallLockTime.add(difference));

        //       expect(await alternativeSetup.controller.connect(root).shutdownPool(pid));
        //       expect(await alternativeSetup.controller.connect(staker).withdrawUnlockedWethBal(pid, twentyMillion));
        //     });
        // });
        // context("» restake testing", () => {       
        //     it("It redeposit tokens", async () => { 
        //       const difference = new BN(2);
        //       const timeDifference = ethers.BigNumber.from(difference.toString());
        //       const BNtimelock = ethers.BigNumber.from(((await time.latest()).add(lockTime)).toString());
        //       const timelock = ethers.BigNumber.from(BNtimelock.add(timeDifference));

        //       expect(await setup.VoterProxy.connect(root).setDepositor(setup.controller.address));
        //       expect(await setup.controller.connect(staker).restake(pid));
        //     });           
        //     it("It redeposit tokens when stash != address(0)", async () => {
        //       time.increase(smallLockTime.add(difference));
        //       const pidStashZero = 2;
        //       expect(await setup.controller.connect(staker).restake(pidStashZero));
        //     });
        //     it("It fails redeposit tokens when pool is closed", async () => {
        //       expect(await setup.controller.connect(root).shutdownPool(pid));

        //       await expectRevert(
        //         setup.controller
        //             .connect(staker)
        //             .restake(pid),
        //         "pool is closed"
        //       );
        //     });
        //     it("It fails redeposit tokens when shutdownSystem", async () => {
        //       expect(await setup.controller.connect(root).shutdownSystem());

        //       await expectRevert(
        //         setup.controller
        //             .connect(staker)
        //             .restake(pid),
        //         "shutdown"
        //       );
        //     });
        // });

});
