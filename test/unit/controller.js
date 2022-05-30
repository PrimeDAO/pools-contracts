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
let staker;
let admin;
let operator;
let authorizer_adaptor;
let reward_manager;
let platformFee;
let profitFee;
let pid;
let rewardFactory;
let stashFactory;
let tokenFactory;
let lptoken;
let gauge;
let wethBalBal;
let feeManager;
let treasury;
let VoterProxy;
let controller; 
let GaugeController;
let tokens;

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
            tokens_: tokens,
            GaugeController_: setup.GaugeController,
            VoterProxy_: setup.VoterProxy,
            controller_: setup.controller,
            rewardFactory_: setup.rewardFactory,
            proxyFactory_: setup.proxyFactory,
            stashFactory_: setup.stashFactory ,
            tokenFactory_: setup.tokenFactory,
            stashFactoryMock_ : setup.stashFactoryMock,
            root_: setup.roles.root,
            staker_: setup.roles.staker,
            admin_: setup.roles.prime,
            reward_manager_: setup.roles.reward_manager,
            authorizer_adaptor: setup.roles.authorizer_adaptor,
            operator: setup.roles.operator,
            randomUser: signers.pop(),
            roles: setup.roles
        }
    });

    context("» setFeeInfo testing", () => {
        it("Checks feeToken", async () => {
            const { controller_ } = await setupTests();
            controller = controller_;
            expect((await controller.feeToken()).toString()).to.equal(zero_address);

        });
    });
    context("» setFees testing", () => {
        before('>>> setup', async function() {
            const { VoterProxy_, controller_, rewardFactory_, stashFactory_, tokenFactory_, GaugeController_, tokens_, root_, staker_ } = await setupTests();
            VoterProxy = VoterProxy_; 
            rewardFactory = rewardFactory_;
            stashFactory = stashFactory_;
            tokenFactory = tokenFactory_; 
            GaugeController = GaugeController_;
            tokens = tokens_;
            controller = controller_;
            root = root_;
            staker= staker_;
        });
        it("Should fail if caller if not feeManager", async () => {
            await expectRevert(
                controller
                    .connect(staker)
                    .setFees(platformFee, profitFee),
                "!auth"
            );      
        });
        it("Sets correct fees", async () => {
            await controller
                    .connect(root)
                    .setFees(platformFee, profitFee);            
        });
        it("Should fail if total >MaxFees", async () => {
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
            platformFee = 400;
            profitFee = 100;
            await controller
                    .connect(root)
                    .setFees(platformFee, profitFee);
            expect((await controller.platformFees()).toString()).to.equal("500");              
        });
        it("Should fail if platformFee is too big", async () => {
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
            platformFee = 500;
            profitFee = 10;
            await controller
                    .connect(root)
                    .setFees(platformFee, profitFee);
            expect((await controller.profitFees()).toString()).to.equal("100");

        });
        it("Should fail if profitFee is too big", async () => {
            platformFee = 500;
            profitFee = 1000;
            await controller
                    .connect(root)
                    .setFees(platformFee, profitFee);
            expect((await controller.profitFees()).toString()).to.equal("100");

        });
    });
    context("» _earmarkRewards testing", () => {
        before('>>> setup', async function() {
            const { VoterProxy_, controller_, rewardFactory_, stashFactory_, stashFactoryMock_, tokenFactory_, GaugeController_, tokens_, roles } = await setupTests();
            VoterProxy = VoterProxy_; 
            rewardFactory = rewardFactory_;
            stashFactory = stashFactory_;
            stashFactoryMock = stashFactoryMock_;
            tokenFactory = tokenFactory_; 
            GaugeController = GaugeController_;
            tokens = tokens_;
            controller = controller_;
            root = roles.root;
            staker = roles.staker;
            admin = roles.prime;
            operator = roles.operator;
            reward_manager = roles.reward_manager;
        });

        it("Calls earmarkRewards with non existing pool number", async () => {
            pid = 1;
            await expectRevert(
                controller
                    .connect(root)
                    .earmarkRewards(pid),
                "Controller: pool is not exists"
            );  
        });
        it("Sets VoterProxy operator ", async () => {
            expect(await VoterProxy.connect(root).setOperator(controller.address));
        });
        it("Sets factories", async () => {
            expect(await controller.connect(root).setFactories(rewardFactory.address, stashFactory.address, tokenFactory.address));
        });
        it("Sets StashFactory implementation ", async () => {
            // Deploy implementation contract
            const implementationAddress = await ethers.getContractFactory('StashMock')
                .then(x => x.deploy())
                .then(x => x.address)
        
            // Set implementation contract
            await expect(stashFactory.connect(root).setImplementation(implementationAddress))
                .to.emit(stashFactory, 'ImpelemntationChanged')
                .withArgs(implementationAddress);
        });
        it("Adds pool", async () => {
            lptoken = tokens.PoolContract;
            gauge = GaugeController;

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
        });
        it("Adds pool with stash == address(0)", async () => {
          expect(await controller.connect(root).setFactories(rewardFactory.address, stashFactoryMock.address, tokenFactory.address));
          await controller.connect(root).addPool(lptoken.address, gauge.address);
          expect(
            (await controller.poolLength()).toNumber()
          ).to.equal(2);
          expect(await controller.connect(root).setFactories(rewardFactory.address, stashFactory.address, tokenFactory.address));
        });
        it("Sets RewardContracts", async () => {
            rewards = rewardFactory;
            stakerRewards = stashFactory;
            expect(await controller.connect(root).setRewardContracts(rewards.address, stakerRewards.address));
        });
        it("Calls earmarkRewards with existing pool number", async () => {
            pid = 0;
            await controller.connect(root).earmarkRewards(pid);
        });
        it("Change feeManager", async () => {
            expect(await controller.connect(root).setFeeManager(reward_manager.address));
            expect(
                (await controller.feeManager()).toString()
            ).to.equal(reward_manager.address.toString());
        });            
        it("Add balance to feeManager", async () => { 
            feeManager = reward_manager;               
            wethBalBal = await tokens.WethBal.balanceOf(controller.address);

            await tokens.WethBal.transfer(feeManager.address, twentyMillion);

            expect(
                (await tokens.WethBal.balanceOf(feeManager.address)).toString()
            ).to.equal(twentyMillion.toString()); 
        });
        it("Add wethBal to Controller address", async () => {           
            expect(await tokens.WethBal.transfer(controller.address, thirtyMillion));
            expect(
                (await tokens.WethBal.balanceOf(controller.address)).toString()
            ).to.equal(thirtyMillion.toString()); 
        });
        it("Calls earmarkRewards with existing pool number with non-empty balance", async () => {
            wethBalBal = await tokens.WethBal.balanceOf(controller.address);
            let profitFees = await controller.profitFees();
            const profit = (wethBalBal * profitFees) / FEE_DENOMINATOR;
            wethBalBal = wethBalBal - profit; //wethBalForTransfer if no treasury
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
            treasury = admin;
            expect(await controller.connect(feeManager).setTreasury(treasury.address));
            expect(
                (await controller.treasury()).toString()
            ).to.equal(admin.address.toString());
        });
        it("Calls earmarkRewards with existing pool number with non-empty balance and treasury", async () => {
            await tokens.WethBal.transfer(controller.address, thirtyMillion);

            wethBalBal = await tokens.WethBal.balanceOf(controller.address);
            let profitFees = await controller.profitFees();
            const profit = (wethBalBal * profitFees) / FEE_DENOMINATOR;
            wethBalBal = wethBalBal - profit;
            let platformFees = await controller.platformFees();
            const platform = (wethBalBal * platformFees) / FEE_DENOMINATOR;
            rewardContract_amount_expected = wethBalBal - platform;

            let treasury_amount_expected = (await tokens.WethBal.balanceOf(treasury.address)).toNumber() + platform;
            let feeManager_amount_expected = (await tokens.WethBal.balanceOf(feeManager.address)).toNumber() + profit;

            await controller.connect(root).earmarkRewards(pid);

            expect(
                (await tokens.WethBal.balanceOf(feeManager.address)).toString()
            ).to.equal(feeManager_amount_expected.toString());
            expect(
                (await tokens.WethBal.balanceOf(treasury.address)).toString()
            ).to.equal(treasury_amount_expected.toString());
            expect(
                (await tokens.WethBal.balanceOf(controller.address)).toString()
            ).to.equal("0");
        });
        it("Sets non-passing fees", async () => {
            await controller
                    .connect(feeManager)
                    .setFees("0", profitFee);            
        });
        it("Calls earmarkRewardsc check 'send treasury' when platformFees = 0", async () => {
            wethBalBal = await tokens.WethBal.balanceOf(controller.address);
            let profitFees = await controller.profitFees();
            const profit = (wethBalBal * profitFees) / FEE_DENOMINATOR;
            wethBalBal = wethBalBal - profit;
            let platformFees = await controller.platformFees();
            const platform = (wethBalBal * platformFees) / FEE_DENOMINATOR;
            rewardContract_amount_expected = wethBalBal - platform;

            let treasury_amount_expected = (await tokens.WethBal.balanceOf(treasury.address)).toNumber() + platform;

            await controller.connect(root).earmarkRewards(pid);

            //expect 0 when platformFees = 0
            expect(
                (await tokens.WethBal.balanceOf(treasury.address)).toString()
            ).to.equal(treasury_amount_expected.toString());
        });            
        it("Sets correct fees back", async () => {
            await controller
                    .connect(feeManager)
                    .setFees(platformFee, profitFee);            
        });
        it("Sets non-passing treasury", async () => {
            expect(await controller.connect(feeManager).setTreasury(controller.address));
            expect(
                (await controller.treasury()).toString()
            ).to.equal(controller.address.toString());
        });
        it("Calls earmarkRewardsc check 'send treasury' when treasury = controller", async () => {
            wethBalBal = await tokens.WethBal.balanceOf(controller.address);
            let profitFees = await controller.profitFees();
            const profit = (wethBalBal * profitFees) / FEE_DENOMINATOR;
            wethBalBal = wethBalBal - profit;
            let platformFees = await controller.platformFees();
            const platform = (wethBalBal * platformFees) / FEE_DENOMINATOR;
            rewardContract_amount_expected = wethBalBal - platform;

            let treasury_amount_expected = (await tokens.WethBal.balanceOf(treasury.address)).toNumber() + platform;

            await controller.connect(root).earmarkRewards(pid);

            //expect 0 when platformFees = 0
            expect(
                (await tokens.WethBal.balanceOf(treasury.address)).toString()
            ).to.equal(treasury_amount_expected.toString());
        });  
        it("Sets correct treasury back", async () => {
            expect(await controller.connect(feeManager).setTreasury(treasury.address));
            expect(
                (await controller.treasury()).toString()
            ).to.equal(admin.address.toString());
        });           
    });        
    context("» earmarkFees testing", () => {
        it("Calls earmarkFees", async () => {

        });
    });
    context("» deposit testing", () => {
        it("It deposit lp tokens from operator stake = true", async () => {
          await tokens.WethBal.transfer(staker.address, twentyMillion);
          const stake = true;

          expect(await controller.connect(operator).deposit(pid, twentyMillion, stake));
        });
        it("It deposit lp tokens stake = true", async () => {
          await tokens.WethBal.transfer(staker.address, twentyMillion);
          const stake = true;

          expect(await controller.connect(staker).deposit(pid, twentyMillion, stake));
        });
        it("It deposit lp tokens stake = false", async () => {
          await tokens.WethBal.transfer(staker.address, twentyMillion);
          const stake = false;
          expect(await controller.connect(staker).deposit(pid, twentyMillion, stake));
        });
    });        
    context("» withdrawUnlockedWethBal testing", () => {
        before('>>> setup', async function() {
            const { VoterProxy_, controller_, rewardFactory_, stashFactory_, stashFactoryMock_, tokenFactory_, GaugeController_, tokens_, roles } = await setupTests();
            VoterProxy = VoterProxy_; 
            rewardFactory = rewardFactory_;
            stashFactory = stashFactory_;
            stashFactoryMock = stashFactoryMock_;
            tokenFactory = tokenFactory_; 
            GaugeController = GaugeController_;
            tokens = tokens_;
            controller = controller_;
            root = roles.root;
            staker = roles.staker;
            admin = roles.prime;
            reward_manager = roles.reward_manager;
            authorizer_adaptor = roles.authorizer_adaptor;

            expect(await VoterProxy.connect(root).setOperator(controller.address));
            expect(await controller.connect(root).setFactories(rewardFactory.address, stashFactory.address, tokenFactory.address));

            // Deploy implementation contract
            const implementationAddress = await ethers.getContractFactory('StashMock')
                .then(x => x.deploy())
                .then(x => x.address)
        
            // Set implementation contract
            await expect(stashFactory.connect(root).setImplementation(implementationAddress))
                .to.emit(stashFactory, 'ImpelemntationChanged')
                .withArgs(implementationAddress);

            lptoken = tokens.PoolContract;
            gauge = GaugeController;
            await controller.connect(root).addPool(lptoken.address, gauge.address);

            rewards = rewardFactory;
            stakerRewards = stashFactory;
            expect(await controller.connect(root).setRewardContracts(rewards.address, stakerRewards.address));
        });
        it("Sets VoterProxy depositor", async () => {
          expect(await VoterProxy.connect(root).setDepositor(root.address));
        });
        it("It configure settings WethBal and VoterProxy", async () => {
          expect(await tokens.VeBal.connect(authorizer_adaptor).commit_smart_wallet_checker(VoterProxy.address));
          expect(await tokens.VeBal.connect(authorizer_adaptor).apply_smart_wallet_checker());
          
          expect(await tokens.WethBal.mint(tokens.VeBal.address, thirtyMillion));
          expect(await tokens.WethBal.mint(VoterProxy.address, sixtyMillion));

          let unlockTime = ((await time.latest()).add(doubleSmallLockTime)).toNumber();
          expect(await VoterProxy.connect(root).createLock(tenMillion, unlockTime));
        });
        it("It increaseAmount WethBal", async () => {
          expect(await VoterProxy.connect(root).increaseAmount(thirtyMillion));     
          let tx = await tokens.VeBal["balanceOf(address,uint256)"](VoterProxy.address, 0);
        });
        it("It withdraw Unlocked WethBal", async () => {
          time.increase(smallLockTime.add(difference));
          const f = await tokens.VeBal["balanceOf(address,uint256)"](VoterProxy.address, 0);
          let treasury_amount_expected = (await tokens.VeBal["balanceOf(address,uint256)"](treasury.address, 0)).add(twentyMillion);
          let unitTest_treasury_amount_expected = 0;
          expect(await controller.connect(staker).withdrawUnlockedWethBal(pid, tenMillion));
          expect(
            (await tokens.VeBal["balanceOf(address,uint256)"](treasury.address, 0)).toString()
          ).to.equal(unitTest_treasury_amount_expected.toString());
        });

        it("It withdraw Unlocked WethBal when pool is closed", async () => {
          const { VoterProxy_, controller_, rewardFactory_, stashFactory_, stashFactoryMock_, tokenFactory_, GaugeController_, tokens_, roles } = await setupTests();

          const root = roles.root;
          const authorizer_adaptor = roles.authorizer_adaptor;
          const staker = roles.staker;

          await VoterProxy_.connect(root).setOperator(controller_.address);
          const rewardFactory = rewardFactory_;
          const stashFactory = stashFactory_;
          const tokenFactory = tokenFactory_;
          await controller_.connect(root).setFactories(rewardFactory.address, stashFactory.address, tokenFactory.address);
          // Deploy implementation contract
          const implementationAddress = await ethers.getContractFactory('StashMock')
            .then(x => x.deploy())
            .then(x => x.address)                      
          // Set implementation contract
          await expect(stashFactory.connect(root).setImplementation(implementationAddress))
            .to.emit(stashFactory, 'ImpelemntationChanged')
            .withArgs(implementationAddress);
          await VoterProxy_.connect(root).setDepositor(root.address);

          await controller_.connect(root).addPool(lptoken.address, gauge.address);              
          await tokens_.WethBal.transfer(staker.address, twentyMillion);

          let unlockTime = ((await time.latest()).add(doubleSmallLockTime)).toNumber();
          await tokens_.VeBal.connect(authorizer_adaptor).commit_smart_wallet_checker(VoterProxy_.address);
          await tokens_.VeBal.connect(authorizer_adaptor).apply_smart_wallet_checker();

          await tokens_.WethBal.mint(tokens_.VeBal.address, thirtyMillion);
          await tokens_.WethBal.mint(VoterProxy_.address, sixtyMillion);

          await VoterProxy_.connect(root).createLock(tenMillion, unlockTime);              
          await VoterProxy_.connect(root).increaseAmount(thirtyMillion);     

          const stake = false;
          const pid = 0;

          time.increase(smallLockTime.add(difference));

          expect(await controller_.connect(root).shutdownPool(pid));
          expect(await controller_.connect(staker).withdrawUnlockedWethBal(pid, twentyMillion));
        });
    });
    context("» restake testing", () => {
        before('>>> setup', async function() {
            const { VoterProxy_, controller_, rewardFactory_, stashFactory_, stashFactoryMock_, tokenFactory_, GaugeController_, tokens_, roles } = await setupTests();
            VoterProxy = VoterProxy_; 
            rewardFactory = rewardFactory_;
            stashFactory = stashFactory_;
            stashFactoryMock = stashFactoryMock_;
            tokenFactory = tokenFactory_; 
            GaugeController = GaugeController_;
            tokens = tokens_;
            controller = controller_;
            root = roles.root;
            staker = roles.staker;
            admin = roles.prime;
            reward_manager = roles.reward_manager;

            expect(await VoterProxy.connect(root).setOperator(controller.address));
            expect(await controller.connect(root).setFactories(rewardFactory.address, stashFactory.address, tokenFactory.address));

            // Deploy implementation contract
            const implementationAddress = await ethers.getContractFactory('StashMock')
                .then(x => x.deploy())
                .then(x => x.address)
        
            // Set implementation contract
            await expect(stashFactory.connect(root).setImplementation(implementationAddress))
                .to.emit(stashFactory, 'ImpelemntationChanged')
                .withArgs(implementationAddress);

            lptoken = tokens.PoolContract;
            gauge = GaugeController;
            await controller.connect(root).addPool(lptoken.address, gauge.address);

            rewards = rewardFactory;
            stakerRewards = stashFactory;
            expect(await controller.connect(root).setRewardContracts(rewards.address, stakerRewards.address));
        });
        it("It redeposit tokens", async () => { 
            const difference = new BN(2);
            const timeDifference = ethers.BigNumber.from(difference.toString());
            const BNtimelock = ethers.BigNumber.from(((await time.latest()).add(lockTime)).toString());
            const timelock = ethers.BigNumber.from(BNtimelock.add(timeDifference));

            expect(await VoterProxy.connect(root).setDepositor(controller.address));
            expect(await controller.connect(staker).restake(pid));
        });          
        it("It redeposit tokens when stash == address(0)", async () => {
            expect(await controller.connect(root).setFactories(rewardFactory.address, stashFactoryMock.address, tokenFactory.address));
            await controller.connect(root).addPool(lptoken.address, gauge.address);
            expect(await controller.connect(root).setFactories(rewardFactory.address, stashFactory.address, tokenFactory.address));

            time.increase(smallLockTime.add(difference));
            const pidStashZero = 1;
            expect(await controller.connect(staker).withdrawUnlockedWethBal(pidStashZero, 0));
            expect(await controller.connect(staker).restake(pidStashZero));
            const BNtimelock = ethers.BigNumber.from(((await time.latest()).add(smallLockTime)).toString());
            const timelock = ethers.BigNumber.from(BNtimelock.add(timeDifference));
        });
        it("It fails redeposit tokens when pool is closed", async () => {
          expect(await controller.connect(root).shutdownPool(pid));

          await expectRevert(
            controller
                .connect(staker)
                .restake(pid),
            "pool is closed"
          );
        });
        it("It fails redeposit tokens when shutdownSystem", async () => {
          expect(await controller.connect(root).shutdownSystem());

          await expectRevert(
            controller
                .connect(staker)
                .restake(pid),
            "shutdown"
          );
        });
    });
});
