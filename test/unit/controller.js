const { expect } = require("chai");
const { deployments, ethers } = require("hardhat");
const { time, expectRevert, BN } = require("@openzeppelin/test-helpers");
const init = require("../test-init.js");

//constants
const zero_address = "0x0000000000000000000000000000000000000000";
const FEE_DENOMINATOR = 10000;
const lockTime = time.duration.days(365);
const smallLockTime = time.duration.days(30);
const tenMillion = 10000000;
const twentyMillion = 20000000;
const thirtyMillion = 30000000;
const sixtyMillion = 60000000;
const difference = new BN(28944000); // 1684568938 - 1655624938 

let root;
let staker;
let admin;
let authorizer_adaptor;
let reward_manager;
let platformFee;
let profitFee;
let pid;
let distro;
let rewardFactory;
let stashFactory;
let tokenFactory;
let lptoken;
let gauge;
let balBal;
let feeManager;
let treasury;
let VoterProxy;
let controller; 
let gaugeMock;
let RegistryMock;
let smartWalletCheckerMock;
let baseRewardPool;
let stashMock;
let VotingMock;
let tokens;

describe("Controller", function () {
    const setupTests = deployments.createFixture(async () => {
        const signers = await ethers.getSigners();
        const setup = await init.initialize(await ethers.getSigners());

        setup.tokens = await init.getTokens(setup);

        setup.GaugeController = await init.gaugeController(setup);

        const lpTokenAddress = setup.tokens.B50WBTC50WETH;
        setup.gaugeMock = await init.getGaugeMock(setup, lpTokenAddress.address);

        setup.VoterProxy = await init.getVoterProxy(setup, setup.GaugeController, setup.tokens.D2DBal);
        
        setup.RegistryMock = await init.getRegistryMock(setup);

        setup.VotingMock = await init.getVotingMock(setup);

        setup.controller = await init.controller(setup);

        setup.rewardFactory = await init.rewardFactory(setup);

        setup.baseRewardPool = await init.baseRewardPool(setup);
            
        setup.proxyFactory = await init.proxyFactory(setup);
      
        setup.stashFactory = await init.stashFactory(setup);
      
        setup.stashFactoryMock = await init.getStashFactoryMock(setup);

        setup.stashMock = await init.getStash(setup);
      
        setup.tokenFactory = await init.tokenFactory(setup);
      
        setup.extraRewardFactory = await init.getExtraRewardMock(setup);

        setup.distroMock = await init.getDistro(setup);//getDistroMock(setup);

        setup.smartWalletCheckerMock = await init.getSmartWalletCheckerMock(setup);
      
        platformFee = 500;
        profitFee = 100;

        return {
            tokens_: setup.tokens,
            GaugeController_: setup.GaugeController,
            gaugeMock_: setup.gaugeMock,
            VoterProxy_: setup.VoterProxy,
            RegistryMock_: setup.RegistryMock,
            baseRewardPool_: setup.baseRewardPool,
            VotingMock_: setup.VotingMock,
            controller_: setup.controller,
            rewardFactory_: setup.rewardFactory,
            proxyFactory_: setup.proxyFactory,
            stashFactory_: setup.stashFactory ,
            tokenFactory_: setup.tokenFactory,
            stashFactoryMock_: setup.stashFactoryMock,
            stashMock_: setup.stashMock,
            smartWalletCheckerMock_: setup.smartWalletCheckerMock,
            distro_: setup.distroMock,
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

    before('>>> setup', async function() {
        const { VoterProxy_, VotingMock_, controller_, rewardFactory_, stashFactory_, stashMock_, stashFactoryMock_, tokenFactory_, smartWalletCheckerMock_, GaugeController_, gaugeMock_, distro_, RegistryMock_, baseRewardPool_, tokens_, roles } = await setupTests();
        VoterProxy = VoterProxy_; 
        rewardFactory = rewardFactory_;
        stashFactory = stashFactory_;
        stashFactoryMock = stashFactoryMock_;
        stashMock = stashMock_;
        VotingMock = VotingMock_;
        tokenFactory = tokenFactory_; 
        GaugeController = GaugeController_;
        smartWalletCheckerMock = smartWalletCheckerMock_;
        gaugeMock = gaugeMock_;
        RegistryMock = RegistryMock_;
        baseRewardPool = baseRewardPool_;
        distro = distro_;
        tokens = tokens_;
        controller = controller_;
        root = roles.root;
        staker = roles.staker;
        admin = roles.prime;
        operator = roles.operator;
        reward_manager = roles.reward_manager;
        authorizer_adaptor = roles.authorizer_adaptor;
    });
    context('» setup', async function () {
        it('Should setup', async function () {
            expect(await controller.isShutdown()).to.equals(false)
            expect(await controller.bal()).to.equals(tokens.BAL.address)
            expect(await controller.wethBal()).to.equals(tokens.WethBal.address)
            expect(await controller.staker()).to.equals(VoterProxy.address)
            expect(await controller.registry()).to.equals(RegistryMock.address)
            expect(await controller.owner()).to.equals(root.address)
            expect(await controller.poolManager()).to.equals(root.address)
            expect(await controller.feeManager()).to.equals(root.address)
            expect(await controller.feeDistro()).to.equals(zero_address)
            expect(await controller.feeToken()).to.equals(zero_address)
            expect(await controller.treasury()).to.equals(zero_address)
        });
    });
    context('» setters', async function () {
        it('Should set owner', async function () {
            expect(await controller.connect(root).setOwner(admin.address));
            expect(await controller.owner()).to.equals(admin.address);
        });
        it('Should fail set owner if not auth', async function () {
            await expectRevert(
                controller
                    .connect(staker)
                    .setOwner(staker.address),
                "!auth"
            );   
        });
        it('Should set feeManager', async function () {
            expect(await controller.connect(root).setFeeManager(admin.address));
            expect(await controller.owner()).to.equals(admin.address);
        });
        it('Should fail set feeManager if not auth', async function () {
            await expectRevert(
                controller
                    .connect(staker)
                    .setFeeManager(staker.address),
                "!auth"
            );     
        });
        it('Should set poolManager', async function () {
            expect(await controller.connect(root).setPoolManager(admin.address));
            expect(await controller.poolManager()).to.equals(admin.address);
        });
        it('Should fail set poolManager if not auth', async function () {
            await expectRevert(
                controller
                    .connect(staker)
                    .setPoolManager(staker.address),
                "!auth"
            );     
        });
        it('Should fail set setFactories if not auth', async function () {
            await expectRevert(
                controller
                    .connect(staker)
                    .setFactories(staker.address, staker.address, staker.address),
                "!auth"
            );     
        });
        it('Should fail set setRewardContracts if not auth', async function () {
            await expectRevert(
                controller
                    .connect(staker)
                    .setRewardContracts(staker.address, staker.address),
                "!auth"
            );     
        });
        it('Should set setArbitrator', async function () {
            expect(await controller.connect(admin).setArbitrator(admin.address));
            expect(await controller.rewardArbitrator()).to.equals(admin.address);
        });
        it('Should fail set setArbitrator if not auth', async function () {
            await expectRevert(
                controller
                    .connect(staker)
                    .setArbitrator(staker.address),
                "!auth"
            );     
        });
        it('Should set voteDelegate', async function () {
            expect(await controller.connect(root).setVoteDelegate(admin.address));
            expect(await controller.voteDelegate()).to.equals(admin.address);
        });
        it('Should fail set voteDelegate if not auth', async function () {
            await expectRevert(
                controller
                    .connect(staker)
                    .setVoteDelegate(staker.address),
                "!auth"
            );     
        });
        it('Should fail set treasury if not auth', async function () {
            await expectRevert(
                controller
                    .connect(staker)
                    .setTreasury(staker.address),
                "!auth"
            );     
        });
        it('Should fail add Pool if lptoken or gauge is address(0)', async function () {
            await expectRevert(
                controller
                    .connect(admin)
                    .addPool(zero_address, zero_address),
                "!param"
            );     
        });
        it('Should fail add Pool if not auth or isShutdown', async function () {
            await expectRevert(
                controller
                    .connect(staker)
                    .addPool(tokens.B50WBTC50WETH.address, gaugeMock.address),
                "!add"
            );     
        });
        it('Should fail shutdown Pool if not auth', async function () {
            await expectRevert(
                controller
                    .connect(staker)
                    .shutdownPool(1),
                "!auth"
            );     
        });
        it('Should fail shutdown System if not auth', async function () {
            await expectRevert(
                controller
                    .connect(staker)
                    .shutdownSystem(),
                "!auth"
            );     
        });
    });
    context("» setFeeInfo testing", () => {
        before('>>> setup', async function() {
            const { } = await setupTests();
        });
        it("Sets VoterProxy operator ", async () => {
            expect(await VoterProxy.connect(root).setOperator(controller.address));
        });
        it("Sets factories", async () => {
            expect(await controller.connect(root).setFactories(rewardFactory.address, stashFactory.address, tokenFactory.address));
        });
        it("Prepare registry and setRewardContracts", async () => {
            await RegistryMock.add_new_id(distro.address, "description of registry");
            const lockRewards = baseRewardPool.address; //address of the main reward pool contract --> baseRewardPool
            const stakerRewards = reward_manager.address; 
            await controller.setRewardContracts(lockRewards, stakerRewards);
        });
        it("Call setFeeInfo", async () => {
            expect((await controller.feeToken()).toString()).to.equal(zero_address);
            expect(await controller.connect(root).setFeeInfo());
            expect((await controller.feeToken()).toString()).to.not.equal(zero_address);
        });
        it("Can not setFeeInfo if not feeManager", async () => {
            await expectRevert(
                controller
                    .connect(staker)
                    .setFeeInfo(),
                "!auth"
            );
        });
        it("Can setFeeInfo if feeToken already setted", async () => {
            expect(await controller.connect(root).setFeeInfo());
        });
    });
    context("» setFees testing", () => {
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
    context("» earmarkFees testing", () => {
        it("Calls earmarkFees", async () => {
            const feeToken = tokens.WethBal; // controller.feeToken() = WethBal
            const balance = await feeToken.balanceOf(controller.address);

            expect(await controller.earmarkFees());
            const lockFees = await controller.lockFees();
            expect(await feeToken.balanceOf(lockFees)).to.equal(balance);
        });
    });
    context("» _earmarkRewards testing", () => {
        it("Calls earmarkRewards with non existing pool number", async () => {
            pid = 1;
            await expectRevert(
                controller
                    .connect(root)
                    .earmarkRewards(pid),
                "Controller: pool is not exists"
            );  
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
            lptoken = tokens.B50WBTC50WETH;
            gauge = gaugeMock;

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
            balBal = await tokens.BAL.balanceOf(controller.address);

            await tokens.BAL.transfer(feeManager.address, twentyMillion);

            expect(
                (await tokens.BAL.balanceOf(feeManager.address)).toString()
            ).to.equal(twentyMillion.toString()); 
        });
        it("Add BAL to Controller address", async () => {           
            expect(await tokens.BAL.transfer(controller.address, thirtyMillion));
            expect(
                (await tokens.BAL.balanceOf(controller.address)).toString()
            ).to.equal(thirtyMillion.toString()); 
        });
        it("Calls earmarkRewards with existing pool number with non-empty balance", async () => {
            balBal = await tokens.BAL.balanceOf(controller.address);
            let profitFees = await controller.profitFees();
            const profit = (balBal * profitFees) / FEE_DENOMINATOR;
            let amount_expected = (await tokens.BAL.balanceOf(feeManager.address)).toNumber() + profit;
            balBal = balBal - profit; //balForTransfer if no treasury

            const poolInfo = await controller.poolInfo(0);
            balRewards = (poolInfo.balRewards).toString();

            await controller.connect(root).earmarkRewards(pid);

            expect(
                (await tokens.BAL.balanceOf(feeManager.address)).toString()
            ).to.equal(amount_expected.toString());
            expect(
                (await tokens.BAL.balanceOf(controller.address)).toString()
            ).to.equal("0");
            expect(
                (await tokens.BAL.balanceOf(balRewards)).toString()
            ).to.equal(balBal.toString());
        });
        it("Set treasury", async () => {
            treasury = admin;
            expect(await controller.connect(feeManager).setTreasury(treasury.address));
            expect(
                (await controller.treasury()).toString()
            ).to.equal(admin.address.toString());
        });
        it("Calls earmarkRewards with existing pool number with non-empty balance and treasury", async () => {
            await tokens.BAL.transfer(controller.address, thirtyMillion);

            balBal = await tokens.BAL.balanceOf(controller.address);
            let profitFees = await controller.profitFees();
            const profit = (balBal * profitFees) / FEE_DENOMINATOR;
            let platformFees = await controller.platformFees();
            const platform = (balBal * platformFees) / FEE_DENOMINATOR;
            balBal = balBal - profit;
            rewardContract_amount_expected = balBal - platform;

            let treasury_amount_expected = (await tokens.BAL.balanceOf(treasury.address)).toNumber() + platform;
            let feeManager_amount_expected = (await tokens.BAL.balanceOf(feeManager.address)).toNumber() + profit;

            await controller.connect(root).earmarkRewards(pid);

            expect(
                (await tokens.BAL.balanceOf(feeManager.address)).toString()
            ).to.equal(feeManager_amount_expected.toString());
            expect(
                (await tokens.BAL.balanceOf(treasury.address)).toString()
            ).to.equal(treasury_amount_expected.toString());
            expect(
                (await tokens.BAL.balanceOf(controller.address)).toString()
            ).to.equal("0");
        });
        it("Sets non-passing fees", async () => {
            await controller
                    .connect(feeManager)
                    .setFees("0", profitFee);            
        });
        it("Calls earmarkRewards check 'send treasury' when platformFees = 0", async () => {
            balBal = await tokens.BAL.balanceOf(controller.address);
            let profitFees = await controller.profitFees();
            const profit = (balBal * profitFees) / FEE_DENOMINATOR;
            let platformFees = await controller.platformFees();
            const platform = (balBal * platformFees) / FEE_DENOMINATOR;
            balBal = balBal - profit;
            rewardContract_amount_expected = balBal - platform;

            let treasury_amount_expected = (await tokens.BAL.balanceOf(treasury.address)).toNumber() + platform;

            await controller.connect(root).earmarkRewards(pid);

            //expect 0 when platformFees = 0
            expect(
                (await tokens.BAL.balanceOf(treasury.address)).toString()
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
        it("Calls earmarkRewards check 'send treasury' when treasury = controller", async () => {
            balBal = await tokens.BAL.balanceOf(controller.address);
            let profitFees = await controller.profitFees();
            const profit = (balBal * profitFees) / FEE_DENOMINATOR;
            let platformFees = await controller.platformFees();
            const platform = (balBal * platformFees) / FEE_DENOMINATOR;
            balBal = balBal - profit;
            rewardContract_amount_expected = balBal - platform;

            let treasury_amount_expected = (await tokens.BAL.balanceOf(treasury.address)).toNumber() + platform;

            await controller.connect(root).earmarkRewards(pid);

            //expect 0 when platformFees = 0
            expect(
                (await tokens.BAL.balanceOf(treasury.address)).toString()
            ).to.equal(treasury_amount_expected.toString());
        }); 
        it("Sets correct treasury back", async () => {
            expect(await controller.connect(feeManager).setTreasury(treasury.address));
            expect(
                (await controller.treasury()).toString()
            ).to.equal(admin.address.toString());
        });
        it("Calls earmarkRewards when stash == address(0)", async () => {
            const zeroStashPid = 1;
            balBal = await tokens.BAL.balanceOf(controller.address);
            let profitFees = await controller.profitFees();
            const profit = (balBal * profitFees) / FEE_DENOMINATOR;
            let platformFees = await controller.platformFees();
            const platform = (balBal * platformFees) / FEE_DENOMINATOR;
            balBal = balBal - profit;
            rewardContract_amount_expected = balBal - platform;

            let treasury_amount_expected = (await tokens.BAL.balanceOf(treasury.address)).toNumber() + platform;

            await controller.connect(root).earmarkRewards(zeroStashPid);

            //expect 0 when platformFees = 0
            expect(
                (await tokens.BAL.balanceOf(treasury.address)).toString()
            ).to.equal(treasury_amount_expected.toString());
        });
        it("Should fails to call earmarkRewards if pool closed", async () => {
            await controller.connect(root).shutdownPool(pid);
            await expectRevert(
                controller
                    .connect(root)
                    .earmarkRewards(pid),
                "pool is closed"
            );
        });
        it("Calls earmarkRewards check 'send treasury' when treasury = controller", async () => {
            await controller.connect(root).shutdownSystem();
            await expectRevert(
                controller
                    .connect(root)
                    .earmarkRewards(pid),
                "shutdown"
            );
        });
        it("Should fails to call earmarkRewards if Shutdown", async () => {
            await controller.connect(root).shutdownPool(pid);
            await controller.connect(root).shutdownSystem();
            await expectRevert(
                controller
                    .connect(root)
                    .earmarkRewards(pid),
                "shutdown"
            );
        });        
    });
    context("» deposit testing", () => {
        before('>>> setup', async function() {
            const { } = await setupTests();

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

            lptoken = tokens.B50WBTC50WETH;
            gauge = gaugeMock;
            await controller.connect(root).addPool(lptoken.address, gauge.address);

            // Add pool with stash == address(0)
            expect(await controller.connect(root).setFactories(rewardFactory.address, stashFactoryMock.address, tokenFactory.address));
            await controller.connect(root).addPool(lptoken.address, gauge.address);
            // Return normal settings back
            expect(await controller.connect(root).setFactories(rewardFactory.address, stashFactory.address, tokenFactory.address));


            await smartWalletCheckerMock.allow(VoterProxy.address);
            await tokens.VeBal.connect(authorizer_adaptor).commit_smart_wallet_checker(smartWalletCheckerMock.address);
            await tokens.VeBal.connect(authorizer_adaptor).apply_smart_wallet_checker();

            rewards = rewardFactory;
            stakerRewards = stashFactory;
            expect(await controller.connect(root).setRewardContracts(rewards.address, stakerRewards.address));
            expect(await VoterProxy.connect(root).setDepositor(root.address));

            treasury = admin;
            expect(await controller.connect(root).setTreasury(treasury.address));
        });
        it("It deposit lp tokens from operator stake = true", async () => {
            await lptoken.mint(staker.address, twentyMillion);
            await lptoken.connect(staker).approve(controller.address, twentyMillion);
            const stake = true;
            
            expect(await controller.connect(staker).deposit(pid, twentyMillion, stake));
        });
        it("It deposit lp tokens stake = true", async () => {
            await lptoken.mint(staker.address, twentyMillion);
            await lptoken.connect(staker).approve(controller.address, twentyMillion);
            const stake = true;

            expect(await controller.connect(staker).deposit(pid, twentyMillion, stake));
        });
        it("It deposit lp tokens stake = false", async () => {
            await lptoken.mint(staker.address, twentyMillion);
            await lptoken.connect(staker).approve(controller.address, twentyMillion);
            const stake = false;
            expect(await controller.connect(staker).deposit(pid, twentyMillion, stake));
        });
        it("It deposit lp tokens if stash == address(0)", async () => {
            const zeroStashPid = 1;

            await lptoken.mint(staker.address, twentyMillion);
            await lptoken.connect(staker).approve(controller.address, twentyMillion);
            const stake = false;
            expect(await controller.connect(staker).deposit(zeroStashPid, twentyMillion, stake));
        });
        it("It can not deposit lp tokens if pool is closed", async () => {
            const zeroStashPid = 1;
            expect(await controller.connect(root).shutdownPool(zeroStashPid));
            const stake = false;
            await expectRevert(
                controller
                    .connect(staker)
                    .deposit(zeroStashPid, twentyMillion, stake),
                "pool is closed"
            );
        });
        it("It can not deposit lp tokens if isShutdown", async () => {
            await controller.connect(root).shutdownSystem();
            const stake = false;
            await expectRevert(
                controller
                    .connect(staker)
                    .deposit(pid, twentyMillion, stake),
                "shutdown"
            );
        });
    });
    context("» depositAll testing", () => {
        before('>>> setup', async function() {
            const { } = await setupTests();

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

            lptoken = tokens.B50WBTC50WETH;
            gauge = gaugeMock;
            await controller.connect(root).addPool(lptoken.address, gauge.address);

            await smartWalletCheckerMock.allow(VoterProxy.address);
            await tokens.VeBal.connect(authorizer_adaptor).commit_smart_wallet_checker(smartWalletCheckerMock.address);
            await tokens.VeBal.connect(authorizer_adaptor).apply_smart_wallet_checker();

            rewards = rewardFactory;
            stakerRewards = stashFactory;
            expect(await controller.connect(root).setRewardContracts(rewards.address, stakerRewards.address));
            expect(await VoterProxy.connect(root).setDepositor(root.address));

            treasury = admin;
            expect(await controller.connect(root).setTreasury(treasury.address));
        });
        it("It deposit all lp tokens", async () => {
          await lptoken.mint(staker.address, twentyMillion);
          await lptoken.connect(staker).approve(controller.address, twentyMillion);
          const stake = true;
          
          expect(await controller.connect(staker).depositAll(pid, stake));
        });
    });        
    context("» withdraw testing", () => {
        before('>>> setup', async function() {
            const { } = await setupTests();

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

            lptoken = tokens.B50WBTC50WETH;
            gauge = gaugeMock;
            await controller.connect(root).addPool(lptoken.address, gauge.address);

            rewards = rewardFactory;
            stakerRewards = stashFactory;
            expect(await controller.connect(root).setRewardContracts(rewards.address, stakerRewards.address));

            expect(await VoterProxy.connect(root).setDepositor(root.address));

            treasury = admin;
            expect(await controller.connect(root).setTreasury(treasury.address));

            await lptoken.mint(staker.address, twentyMillion);
            await lptoken.connect(staker).approve(controller.address, twentyMillion);
            const stake = false;
            expect(await controller.connect(staker).depositAll(pid, stake));
        });
        it("It withdraw lp tokens", async () => {
            time.increase(lockTime.add(difference));
            
            expect(await controller.connect(staker).withdraw(pid, tenMillion));

            expect(
                (await lptoken.balanceOf(staker.address)).toString()
            ).to.equal(tenMillion.toString());
        });
        it("It withdraw Unlocked WethBal when pool is closed", async () => {
          const { VoterProxy_, controller_, rewardFactory_, stashFactory_, gaugeMock_, tokenFactory_, tokens_, roles } = await setupTests();

          const root = roles.root;
          const authorizer_adaptor = roles.authorizer_adaptor;
          const staker = roles.staker;

          await expect(VoterProxy_.connect(root).setOperator(controller_.address));
          await expect(VoterProxy_.connect(root).setDepositor(controller_.address));

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

          const lptoken = tokens_.B50WBTC50WETH;
          const gauge = gaugeMock_;
          await controller_.connect(root).addPool(lptoken.address, gauge.address);              
          await tokens_.WethBal.transfer(staker.address, twentyMillion);

          await tokens_.VeBal.connect(authorizer_adaptor).commit_smart_wallet_checker(VoterProxy_.address);
          await tokens_.VeBal.connect(authorizer_adaptor).apply_smart_wallet_checker();

          await tokens_.WethBal.mint(tokens_.VeBal.address, thirtyMillion);
          await tokens_.WethBal.mint(VoterProxy_.address, sixtyMillion);

          const pid = 0;

          expect(await controller_.connect(root).shutdownPool(pid));
          expect(await controller_.connect(staker).withdrawUnlockedWethBal(pid, twentyMillion));
        });
    });
    context("» withdrawTo testing", () => {
        before('>>> setup', async function() {
            const { } = await setupTests();

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

            lptoken = tokens.B50WBTC50WETH;
            gauge = gaugeMock;
            await controller.connect(root).addPool(lptoken.address, gauge.address);

            rewards = rewardFactory;
            stakerRewards = stashFactory;
            expect(await controller.connect(root).setRewardContracts(rewards.address, stakerRewards.address));

            expect(await VoterProxy.connect(root).setDepositor(root.address));

            treasury = admin;
            expect(await controller.connect(root).setTreasury(treasury.address));

            await lptoken.mint(staker.address, twentyMillion);
            await lptoken.connect(staker).approve(controller.address, twentyMillion);
            const stake = false;
            expect(await controller.connect(staker).depositAll(pid, stake));
        });
        it("It fails withdrawTo lp tokens if not auth", async () => {
            await expectRevert(
                controller
                    .connect(staker)
                    .withdrawTo(pid, tenMillion, staker.address),
                "!auth"
            );  
        });
        it("Calls withdrawTo", async () => {
            const amount = tenMillion;
            const claim = true;

            const poolInfo = await controller.poolInfo(0);
            const rewardPoolAddress = poolInfo.balRewards.toString();
            //Get new rewardPool and attach to that address
            const rewardPool = await ethers
                .getContractFactory("BaseRewardPool")
                .then((x) => x.attach(rewardPoolAddress));

            const stake = true;
            expect(await lptoken.connect(root).mint(root.address, amount));
            expect(await lptoken.connect(root).approve(controller.address, amount));
            expect(await controller.connect(root).deposit(0, amount, stake)); //from deposit in controller only

            time.increase(lockTime.add(difference));
            
            expect(await rewardPool.connect(root).withdrawAndUnwrap(amount, claim));
        });
    });
    context("» withdrawAll testing", () => {
        before('>>> setup', async function() {
            const { } = await setupTests();

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

            lptoken = tokens.B50WBTC50WETH;
            gauge = gaugeMock;
            await controller.connect(root).addPool(lptoken.address, gauge.address);

            rewards = rewardFactory;
            stakerRewards = stashFactory;
            expect(await controller.connect(root).setRewardContracts(rewards.address, stakerRewards.address));

            expect(await VoterProxy.connect(root).setDepositor(root.address));

            treasury = admin;
            expect(await controller.connect(root).setTreasury(treasury.address));

            await lptoken.mint(staker.address, twentyMillion);
            await lptoken.connect(staker).approve(controller.address, twentyMillion);
            const stake = false;
            
            expect(await controller.connect(staker).depositAll(pid, stake));
        });
        it("It withdraw all lp tokens", async () => {
            time.increase(lockTime.add(difference));

            expect(await controller.connect(staker).withdrawAll(pid));
            expect(
                (await lptoken.balanceOf(staker.address)).toString()
            ).to.equal(twentyMillion.toString());
        });
        it("It withdrawAll when pool is closed", async () => {
          const { VoterProxy_, controller_, rewardFactory_, stashFactory_, gaugeMock_, tokenFactory_, tokens_, roles } = await setupTests();

          const root = roles.root;
          const authorizer_adaptor = roles.authorizer_adaptor;
          const staker = roles.staker;

          await expect(VoterProxy_.connect(root).setOperator(controller_.address));
          await expect(VoterProxy_.connect(root).setDepositor(controller_.address));

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

          const lptoken = tokens_.B50WBTC50WETH;
          const gauge = gaugeMock_;
          await controller_.connect(root).addPool(lptoken.address, gauge.address);              
          await tokens_.WethBal.transfer(staker.address, twentyMillion);

          await tokens_.VeBal.connect(authorizer_adaptor).commit_smart_wallet_checker(VoterProxy_.address);
          await tokens_.VeBal.connect(authorizer_adaptor).apply_smart_wallet_checker();

          await tokens_.WethBal.mint(tokens_.VeBal.address, thirtyMillion);
          await tokens_.WethBal.mint(VoterProxy_.address, sixtyMillion);

          const pid = 0;

          expect(await controller_.connect(root).shutdownPool(pid));
          expect(await controller_.connect(staker).withdrawAll(pid));
        });
    });
    context("» withdrawUnlockedWethBal testing", () => {
        before('>>> setup', async function() {
            const { } = await setupTests();

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

            lptoken = tokens.B50WBTC50WETH;
            gauge = gaugeMock;
            await controller.connect(root).addPool(lptoken.address, gauge.address);

            rewards = rewardFactory;
            stakerRewards = stashFactory;
            expect(await controller.connect(root).setRewardContracts(rewards.address, stakerRewards.address));

            expect(await VoterProxy.connect(root).setDepositor(root.address));

            treasury = admin;
            expect(await controller.connect(root).setTreasury(treasury.address));
        });
        
        it("It withdraw Unlocked WethBal", async () => {
          time.increase(smallLockTime.add(difference));
          let unitTest_treasury_amount_expected = 0;
          expect(await controller.connect(staker).withdrawUnlockedWethBal(pid, tenMillion));
          expect(
            (await tokens.VeBal["balanceOf(address,uint256)"](treasury.address, 0)).toString()
          ).to.equal(unitTest_treasury_amount_expected.toString());
        });

        it("It withdraw Unlocked WethBal when pool is closed", async () => {
          const { VoterProxy_, controller_, rewardFactory_, stashFactory_, gaugeMock_, tokenFactory_, tokens_, roles } = await setupTests();

          const root = roles.root;
          const authorizer_adaptor = roles.authorizer_adaptor;
          const staker = roles.staker;

          await expect(VoterProxy_.connect(root).setOperator(controller_.address));
          await expect(VoterProxy_.connect(root).setDepositor(controller_.address));

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

          const lptoken = tokens_.B50WBTC50WETH;
          const gauge = gaugeMock_;
          await controller_.connect(root).addPool(lptoken.address, gauge.address);              
          await tokens_.WethBal.transfer(staker.address, twentyMillion);

          await tokens_.VeBal.connect(authorizer_adaptor).commit_smart_wallet_checker(VoterProxy_.address);
          await tokens_.VeBal.connect(authorizer_adaptor).apply_smart_wallet_checker();

          await tokens_.WethBal.mint(tokens_.VeBal.address, thirtyMillion);
          await tokens_.WethBal.mint(VoterProxy_.address, sixtyMillion);

          const pid = 0;

          expect(await controller_.connect(root).shutdownPool(pid));
          expect(await controller_.connect(staker).withdrawUnlockedWethBal(pid, twentyMillion));
        });
    });
    context("» restake testing", () => {
        before('>>> setup', async function() {
            const { } = await setupTests();

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

            lptoken = tokens.B50WBTC50WETH;
            gauge = gaugeMock;
            await controller.connect(root).addPool(lptoken.address, gauge.address);

            await smartWalletCheckerMock.allow(VoterProxy.address);
            await tokens.VeBal.connect(authorizer_adaptor).commit_smart_wallet_checker(smartWalletCheckerMock.address);
            await tokens.VeBal.connect(authorizer_adaptor).apply_smart_wallet_checker();

            rewards = rewardFactory;
            stakerRewards = stashFactory;
            expect(await controller.connect(root).setRewardContracts(rewards.address, stakerRewards.address));
            expect(await VoterProxy.connect(root).setDepositor(root.address));

            treasury = admin;
            expect(await controller.connect(root).setTreasury(treasury.address));
        });
        it("It redeposit tokens", async () => { 
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
    context("» vote testing", () => {
        it("Fails to call vote if not auth", async () => {
            const voteId = 1;
            const votingAddress = staker.address;
            const support = true;
            await expectRevert(
                controller
                    .connect(staker)
                    .vote(voteId, votingAddress, support),
                "!auth"
            );   
        });
        it("Fails to call vote if not voteAddr", async () => {
            const voteId = 1;
            const votingAddress = staker.address;
            const support = true;

            await expectRevert(
                controller
                    .connect(root)
                    .vote(voteId, votingAddress, support),
                "!voteAddr"
            );  
        });
        it("Calls vote", async () => {
            const voteId = 1;
            const votingAddress = VotingMock.address;
            const support = true;

            expect(await controller.connect(root).vote(voteId, votingAddress, support));
        });
    });
    context("» voteGaugeWeight testing", () => {
        before('>>> setup', async function() {
            const setup = await init.initialize(await ethers.getSigners());
    
            setup.tokens = await init.getTokens(setup);    
            setup.GaugeController = await init.gaugeController(setup);    
            const lpTokenAddress = setup.tokens.B50WBTC50WETH;
            setup.gaugeMock = await init.getGaugeMock(setup, lpTokenAddress.address);        
            setup.VoterProxy = await init.getVoterProxyMock(setup);            
            setup.RegistryMock = await init.getRegistryMock(setup);  
            setup.VotingMock = await init.getVotingMock(setup);  
            setup.controller = await init.controller(setup);
            setup.rewardFactory = await init.rewardFactory(setup);        
            setup.baseRewardPool = await init.baseRewardPool(setup);                
            setup.proxyFactory = await init.proxyFactory(setup);          
            setup.stashFactory = await init.stashFactory(setup);          
            setup.stashFactoryMock = await init.getStashFactoryMock(setup);    
            setup.stashMock = await init.getStashMock(setup);          
            setup.tokenFactory = await init.tokenFactory(setup);          
            setup.extraRewardFactory = await init.getExtraRewardMock(setup);    
            setup.distroMock = await init.getDistro(setup);//getDistroMock(setup);    
            setup.smartWalletCheckerMock = await init.getSmartWalletCheckerMock(setup);          
            platformFee = 500;
            profitFee = 100;

            root = setup.roles.root;
            const authorizer_adaptor = setup.roles.authorizer_adaptor;
            staker = setup.roles.staker;
  
            setup.VoterProxy.connect(root).setOperator(setup.controller.address);
            setup.VoterProxy.connect(root).setDepositor(setup.controller.address);  
            await setup.controller.connect(root).setFactories(setup.rewardFactory.address, setup.stashFactory.address, setup.tokenFactory.address);
            // Deploy implementation contract
            const implementationAddress = await ethers.getContractFactory('ExtraRewardStashV3')
              .then(x => x.deploy())
              .then(x => x.address)                      
            // Set implementation contract
            await expect(setup.stashFactory.connect(root).setImplementation(implementationAddress))
              .to.emit(setup.stashFactory, 'ImpelemntationChanged')
              .withArgs(implementationAddress);
  
            lptoken = setup.tokens.B50WBTC50WETH;
            gauge = setup.gaugeMock;
            await setup.controller.connect(root).addPool(lptoken.address, gauge.address);              
            await setup.tokens.WethBal.transfer(staker.address, twentyMillion);
  
            await setup.tokens.VeBal.connect(authorizer_adaptor).commit_smart_wallet_checker(setup.VoterProxy.address);
            await setup.tokens.VeBal.connect(authorizer_adaptor).apply_smart_wallet_checker();

            controller = setup.controller;
            VoterProxy = setup.VoterProxy;
            rewardFactory = setup.rewardFactory;
            stashMock = setup.stashMock;
            implementation = implementationAddress;
            D2DBal = setup.tokens.D2DBal;
        });
        it("Calls voteGaugeWeight", async () => {
            expect(await controller.voteGaugeWeight([gauge.address, gauge.address], [1, 1]));
        });
        it("Fails to call voteGaugeWeight if not auth", async () => {
            await expectRevert(
                controller
                    .connect(staker)
                    .voteGaugeWeight([gauge.address, gauge.address], [1, 1]),
                "!auth"
            ); 
        });
    });
    context("» claimRewards testing", () => {
        it("Calls claimRewards", async () => {
            // need to call from StashMock contract directly
            expect(await stashMock.initialize(pid, controller.address, staker.address, gauge.address, rewardFactory.address));

            expect(await controller.connect(root).earmarkRewards(pid));
            expect(await controller.connect(root).earmarkRewards(pid));

        });
        it("Fails to call claimRewards if not auth", async () => {
            await expectRevert(
                controller
                    .connect(staker)
                    .claimRewards(pid, gauge.address),
                "!auth"
            );   
        });
    });
    context("» setGaugeRedirect testing", () => {
        it("Fails to call setGaugeRedirect if not auth", async () => {
            await expectRevert(
                controller
                    .connect(staker)
                    .setGaugeRedirect(pid),
                "!auth"
            );   
        });
    });
    context("» rewardClaimed testing", () => {
        before('>>> setup', async function() {
            const signers = await ethers.getSigners();
            const setup = await init.initialize(await ethers.getSigners());
    
            setup.tokens = await init.getTokens(setup);    
            setup.GaugeController = await init.gaugeController(setup);    
            const lpTokenAddress = setup.tokens.B50WBTC50WETH;
            setup.gaugeMock = await init.getGaugeMock(setup, lpTokenAddress.address);        
            setup.VoterProxy = await init.getVoterProxy(setup, setup.GaugeController, setup.tokens.D2DBal);
            setup.RegistryMock = await init.getRegistryMock(setup);  
            setup.VotingMock = await init.getVotingMock(setup);  
            setup.controller = await init.controller(setup);  
            setup.rewardFactory = await init.rewardFactory(setup);        
            setup.baseRewardPool = await init.baseRewardPool(setup);                
            setup.proxyFactory = await init.proxyFactory(setup);          
            setup.stashFactory = await init.stashFactory(setup);          
            setup.stashFactoryMock = await init.getStashFactoryMock(setup);    
            setup.stashMock = await init.getStashMock(setup);          
            setup.tokenFactory = await init.tokenFactory(setup);          
            setup.extraRewardFactory = await init.getExtraRewardMock(setup);    
            setup.distroMock = await init.getDistro(setup);
            setup.smartWalletCheckerMock = await init.getSmartWalletCheckerMock(setup);          
            platformFee = 500;
            profitFee = 100;

            root = setup.roles.root;
            const authorizer_adaptor = setup.roles.authorizer_adaptor;
            staker = setup.roles.staker;
  
            setup.VoterProxy.connect(root).setOperator(setup.controller.address);
            setup.VoterProxy.connect(root).setDepositor(setup.controller.address);  
            await setup.controller.connect(root).setFactories(setup.rewardFactory.address, setup.stashFactory.address, setup.tokenFactory.address);
            // Deploy implementation contract
            const implementationAddress = await ethers.getContractFactory('ExtraRewardStashV3')
              .then(x => x.deploy())
              .then(x => x.address)                      
            // Set implementation contract
            await expect(setup.stashFactory.connect(root).setImplementation(implementationAddress))
              .to.emit(setup.stashFactory, 'ImpelemntationChanged')
              .withArgs(implementationAddress);
  
            lptoken = setup.tokens.B50WBTC50WETH;
            gauge = setup.gaugeMock;
            await setup.controller.connect(root).addPool(lptoken.address, gauge.address);              
            await setup.tokens.WethBal.transfer(staker.address, twentyMillion);
  
            await setup.tokens.VeBal.connect(authorizer_adaptor).commit_smart_wallet_checker(setup.VoterProxy.address);
            await setup.tokens.VeBal.connect(authorizer_adaptor).apply_smart_wallet_checker();

            controller = setup.controller;
            VoterProxy = setup.VoterProxy;
            rewardFactory = setup.rewardFactory;
            stashMock = setup.stashMock;
            implementation = implementationAddress;
            D2DBal = setup.tokens.D2DBal;
        });
        it('Fails to call rewardClaimed if not auth', async function () {
            await expectRevert(
                controller
                    .connect(staker)
                    .rewardClaimed(pid, staker.address, tenMillion),
                "!auth"
            );     
        });
        it("Calls rewardClaimed", async () => {
            const amount = tenMillion;

            const poolInfo = await controller.poolInfo(0);
            const rewardPoolAddress = poolInfo.balRewards.toString();
            //Get new rewardPool and attach to that address
            const rewardPool = await ethers
                .getContractFactory("BaseRewardPool")
                .then((x) => x.attach(rewardPoolAddress));

            const stake = true;
            expect(await lptoken.connect(root).mint(root.address, amount));
            expect(await lptoken.connect(root).approve(controller.address, amount));
            expect(await controller.connect(root).deposit(0, amount, stake));

            time.increase(lockTime.add(difference));
            time.increase(lockTime.add(difference));

            const claimExtras = true;
            expect(await rewardPool["getReward(address,bool)"](root.address, claimExtras));
        });
    });
});
