const { expect } = require("chai");
const { deployments, ethers } = require("hardhat");
const { time, expectRevert, BN } = require("@openzeppelin/test-helpers");
const init = require("../test-init.js");

//constants
const zero_address = "0x0000000000000000000000000000000000000000";
const FEE_DENOMINATOR = 10000;
const smallLockTime = time.duration.days(30);
const tenMillion = 30000000;
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
let baseRewardPool;
let tokens;
let feeDistributor;

describe("unit - Controller", function () {
    const setupTests = deployments.createFixture(async () => {
        const signers = await ethers.getSigners();
        const setup = await init.initialize(await ethers.getSigners());

        setup.tokens = await init.getTokens(setup);

        setup.GaugeController = await init.gaugeController(setup);

        const lpTokenAddress = setup.tokens.B50WBTC50WETH;
        setup.gaugeMock = await init.getGaugeMock(setup, lpTokenAddress.address);

        setup.VoterProxy = await init.getVoterProxy(setup, setup.GaugeController, setup.tokens.D2DBal);

        setup.VoterProxyMockFactory = await init.getVoterProxyMock(setup);

        feeDistributor = await init.getDistroMock(setup)

        setup.controller = await init.controller(setup, feeDistributor);

        setup.rewardFactory = await init.rewardFactory(setup);

        setup.baseRewardPool = await init.baseRewardPool(setup);

        setup.proxyFactory = await init.proxyFactory(setup);

        setup.stashFactory = await init.stashFactory(setup);

        setup.stashFactoryMock = await init.getStashFactoryMock(setup);

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
            baseRewardPool_: setup.baseRewardPool,
            controller_: setup.controller,
            rewardFactory_: setup.rewardFactory,
            proxyFactory_: setup.proxyFactory,
            stashFactory_: setup.stashFactory,
            tokenFactory_: setup.tokenFactory,
            stashFactoryMock_: setup.stashFactoryMock,
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

    before('>>> setup', async function () {
        const { VoterProxy_, controller_, rewardFactory_, stashFactory_, stashFactoryMock_, tokenFactory_, smartWalletCheckerMock_, GaugeController_, gaugeMock_, distro_, baseRewardPool_, tokens_, roles } = await setupTests();
        VoterProxy = VoterProxy_;
        rewardFactory = rewardFactory_;
        stashFactory = stashFactory_;
        stashFactoryMock = stashFactoryMock_;
        smartWalletCheckerMock = smartWalletCheckerMock_;
        tokenFactory = tokenFactory_;
        GaugeController = GaugeController_;
        gaugeMock = gaugeMock_;
        baseRewardPool = baseRewardPool_;
        tokens = tokens_;
        controller = controller_;
        distro = distro_;
        root = roles.root;
        staker = roles.staker;
        admin = roles.prime;
        operator = roles.operator;
        reward_manager = roles.reward_manager;
    });
    context('setup', async function () {
        it('should setup', async function () {
            expect(await controller.isShutdown()).to.equals(false)
            expect(await controller.bal()).to.equals(tokens.BAL.address)
            expect(await controller.staker()).to.equals(VoterProxy.address)
            expect(await controller.owner()).to.equals(root.address)
            expect(await controller.poolManager()).to.equals(root.address)
            expect(await controller.feeManager()).to.equals(root.address)
            expect(await controller.feeDistro()).to.equals(feeDistributor.address)
            expect(await controller.feeToken()).to.equals(zero_address)
            expect(await controller.treasury()).to.equals(zero_address)
        });
    });
    context("» setFeeInfo testing", () => {
        it("Sets VoterProxy operator ", async () => {
            expect(await VoterProxy.connect(root).setOperator(controller.address));
        });
        it("Sets factories", async () => {
            expect(await controller.connect(root).setFactories(rewardFactory.address, stashFactory.address, tokenFactory.address));
        });
        it("Sets RewardContracts", async () => {
            expect(await controller.connect(root).setRewardContracts(baseRewardPool.address));
        });
        it("Call setFeeInfo", async () => {
            expect((await controller.feeToken()).toString()).to.equal(zero_address);
            expect(await controller.connect(root).setFeeInfo(tokens.BAL.address));
            expect((await controller.feeToken()).toString()).to.not.equal(zero_address);
        });
        it("Can not setFeeInfo if not feeManager", async () => {
            await expectRevert(
                controller
                    .connect(staker)
                    .setFeeInfo(tokens.BAL.address),
                "Unauthorized()"
            );
        });
    });
    context("» setFees testing", () => {
        it("Should fail if caller if not feeManager", async () => {
            await expectRevert(
                controller
                    .connect(staker)
                    .setFees(platformFee, profitFee),
                "Unauthorized()"
            );
        });
        it("Sets correct fees", async () => {
            await controller
                .connect(root)
                .setFees(platformFee, profitFee);
        });
        it("Should fail if total >MAX_FEES", async () => {
            platformFee = 2000;
            profitFee = 1001;
            await expectRevert(
                controller
                    .connect(root)
                    .setFees(platformFee, profitFee),
                "InvalidParameters()"
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
                "InvalidParameters()"
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
            profitFee = 2000;
            await controller
                .connect(root)
                .setFees(platformFee, profitFee);
            expect((await controller.profitFees()).toString()).to.equal("100");
        });
    });
    context("» _earmarkRewards testing", () => {
        it("Calls earmarkRewards with non existing pool number", async () => {
            pid = 1;
            await expectRevert(
                controller
                    .connect(root)
                    .earmarkRewards(pid),
                "VM Exception while processing transaction: reverted with panic code 0x32 (Array accessed at an out-of-bounds or negative index)"
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
        it("Calls earmarkRewardsc check 'send treasury' when platformFees = 0", async () => {
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
        it("Calls earmarkRewardsc check 'send treasury' when treasury = controller", async () => {
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
    context("» deposit testing", () => {
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
    });
    context("» withdrawUnlockedWethBal testing", () => {
        before('>>> setup', async function () {
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

            lptoken = tokens.B50WBTC50WETH;
            gauge = gaugeMock;
            await controller.connect(root).addPool(lptoken.address, gauge.address);

            rewards = rewardFactory;
            stakerRewards = stashFactory;
            expect(await controller.connect(root).setRewardContracts(rewards.address));
        });
        it("Sets VoterProxy depositor", async () => {
            expect(await VoterProxy.connect(root).setDepositor(root.address));
        });
        it("It configure settings WethBal and VoterProxy", async () => {
            expect(await tokens.VeBal.connect(authorizer_adaptor).commit_smart_wallet_checker(VoterProxy.address));
            expect(await tokens.VeBal.connect(authorizer_adaptor).apply_smart_wallet_checker());

            expect(await tokens.WethBal.mint(tokens.VeBal.address, thirtyMillion));
            expect(await tokens.WethBal.mint(VoterProxy.address, sixtyMillion));

            expect(await controller.connect(root).setRewardContracts(rewards.address));

            expect(await VoterProxy.connect(root).setDepositor(root.address));

            treasury = admin;
            expect(await controller.connect(root).setTreasury(treasury.address));
        });

        it("withdraws unlocked WethBal", async () => {
            time.increase(smallLockTime.add(difference));
            let unitTest_treasury_amount_expected = 0;
            expect(await controller.connect(staker).withdrawUnlockedWethBal(tenMillion));
            expect(
                (await tokens.VeBal["balanceOf(address,uint256)"](treasury.address, 0)).toString()
            ).to.equal(unitTest_treasury_amount_expected.toString());
        });
    });
});
