const { expect } = require("chai");
const { deployments } = require("hardhat");
const { ONE_HUNDRED_ETHER } = require("../helpers/constants");
const { getContract, impersonateAddress, increaseTime } = require("../helpers/helpers");
const { getAddresses } = require('../../config');
const { bal } = getAddresses()

const lpToken = '0x647c1fd457b95b75d0972ff08fe01d7d7bda05df' // LP TOKEN Balancer 50 WBTC 50 WETH 
const gauge = '0xE190E5363C925513228Bf25E4633C8cca4809C9a' // Gauge for pool 50WBTC 50WETH
const lpTokenHolderAddress = '0x79613fb99098089e454ca2439eca452d3740391f' // LP token Whale that we impersonate

const WETHBAL = '0xDC2EcFDf2688f92c85064bE0b929693ACC6dBcA6' // WETHBAL TOKEN 80BAL-20WETH
const WETHBALHolderAddress = '0xbF63Afb77A49159b4502E91CD3f4EbDcc161431f' // WETHBAL token Whale that we impersonate

describe("Kovan integration", function () {

    let voterProxy, d2DBal, balDepositor, controller, rewardFactory, lpTokenContract;

    const setupTests = deployments.createFixture(async () => {
        // deploy contract to local fork
        const setup = await deployments.fixture()

        voterProxy = await getContract('VoterProxy', setup.VoterProxy.address)
        d2DBal = await getContract('D2DBal', setup.D2DBal.address)
        balDepositor = await getContract('BalDepositor', setup.BalDepositor.address)
        controller = await getContract('Controller', setup.Controller.address)
        rewardFactory = await getContract('RewardFactory', setup.RewardFactory.address)
        lpTokenContract = await getContract('ERC20Mock', lpToken)
    });

    beforeEach(async function () {
        // skip test if we're not on kovan fork
        if (process.env.BLOCKCHAIN_FORK !== 'kovan') {
            this.skip();
        }
        await setupTests();
    });

    it("setup", async function () {
        const { root } = await getNamedAccounts();

        expect(await controller.poolManager()).to.equals(root)
        expect(await controller.voteDelegate()).to.equals(root)
        expect(await voterProxy.owner()).to.equals(root)
        expect(await balDepositor.feeManager()).to.equals(root)
        expect(await d2DBal.name()).to.equals('D2DBal')
    });

    it("adds pool, deposits LP tokens, earmarks rewards, fee manager, treasury get BAL, staker withdraws", async function () {
        await expect(controller.addPool(lpToken, gauge)).to.emit(rewardFactory, 'BaseRewardPoolCreated');
        // creates a pool with PID 0
        const pid = 0

        // We impersonate LP token WHALE and make him a signer
        const signer = await impersonateAddress(lpTokenHolderAddress);
        await lpTokenContract.connect(signer).approve(controller.address, ONE_HUNDRED_ETHER)

        const balTokenContract = await getContract('ERC20Mock', bal);

        // root is deployer + feeManager
        // it starts with 0 BAL balance
        const { root, treasury } = await getNamedAccounts();
        expect(await balTokenContract.balanceOf(root)).to.equals(0)
        expect(await balTokenContract.balanceOf(treasury)).to.equals(0)
        
        // add treasury
        await expect(controller.setTreasury(treasury))
            .to.emit(controller, 'TreasuryChanged')
            .withArgs(treasury);

        // deposit from signer
        await expect(controller.connect(signer).deposit(pid, ONE_HUNDRED_ETHER, false)) // do not stake tokens
            .to.emit(controller, 'Deposited')
            .withArgs(signer.address, pid, ONE_HUNDRED_ETHER);

        await increaseTime(60 * 60 * 24 * 10) // 10 days

        await controller.earmarkRewards(pid)

        // Fee Manager (root) BAL balance should not be zero anymore
        expect(await balTokenContract.balanceOf(root)).to.not.equals(0)
        // Treasury (root) BAL balance should not be zero anymore
        expect(await balTokenContract.balanceOf(treasury)).to.not.equals(0)

        await expect(controller.connect(signer).withdraw(pid, ONE_HUNDRED_ETHER))
            .to.emit(controller, 'Withdrawn')
            .withArgs(signer.address, pid, ONE_HUNDRED_ETHER);
    })

    it("tries to initial lock wethBal", async function () {
        // can't lock it :(
        await expect(balDepositor.initialLock()).to.be.revertedWith('Smart contract depositors not allowed')
    })

    it("It deposit and withdraw WethBal", async () => {
        const pid = 0

        // We impersonate LP token WHALE and make him a signer
        const signer = await impersonateAddress(WETHBALHolderAddress);
        await WETHBAL.connect(signer).approve(balDepositor.address, ONE_HUNDRED_ETHER);

        const before = (await WETHBAL.balanceOf(balDepositor.address)).toNumber();
        const depositAmount = ONE_HUNDRED_ETHER;
        expect(await balDepositor.deposit(depositAmount, false, baseRewardPool.address));

        const after = before.add(ONE_HUNDRED_ETHER.toNumber());
        expect(await WETHBAL.balanceOf(balDepositor.address)).to.equals(after);

        await increaseTime(60 * 60 * 24 * 365) // 365 days

        expect(await controller.connect(root).withdrawUnlockedWethBal(pid, ONE_HUNDRED_ETHER));
        // expect(
            // (await tokens.VeBal["balanceOf(address,uint256)"](treasury.address, 0)).toString()
        // ).to.equal(ONE_HUNDRED_ETHER.toString());
    });
    
});

