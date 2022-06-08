const { expect } = require("chai");
const { deployments } = require("hardhat");
const { ONE_HUNDRED_ETHER } = require("../helpers/constants");
const { getContract, impersonateAddress, increaseTime } = require("../helpers/helpers");
const { getAddresses } = require('../../config');
const { bal } = getAddresses()

const lpToken = '0x647c1fd457b95b75d0972ff08fe01d7d7bda05df' // LP TOKEN Balancer 50 WBTC 50 WETH 
const gauge = '0xE190E5363C925513228Bf25E4633C8cca4809C9a' // Gauge for pool 50WBTC 50WETH
const lpTokenHolderAddress = '0x79613fb99098089e454ca2439eca452d3740391f' // LP token Whale that we impersonate

const balWhale = '0x8c7bc53a5f6744c3a210868cd7db987ab0c2fece' // BAL Whale

describe("Kovan integration", function () {

    let voterProxy, d2DBal, balDepositor, controller, rewardFactory, lpTokenContract, balTokenContract;

    const setupTests = deployments.createFixture(async () => {
        // deploy contract to local fork
        const setup = await deployments.fixture()

        voterProxy = await getContract('VoterProxy', setup.VoterProxy.address)
        d2DBal = await getContract('D2DBal', setup.D2DBal.address)
        balDepositor = await getContract('BalDepositor', setup.BalDepositor.address)
        controller = await getContract('Controller', setup.Controller.address)
        rewardFactory = await getContract('RewardFactory', setup.RewardFactory.address)
        lpTokenContract = await getContract('ERC20Mock', lpToken)
        balTokenContract = await getContract('ERC20Mock', bal)
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

    it("adds pool, deposits LP tokens, earmarks rewards, treasury acc gets BAL, staker withdraws", async function () {
        await expect(controller.addPool(lpToken, gauge)).to.emit(rewardFactory, 'BaseRewardPoolCreated');
        // creates a pool with PID 0
        const pid = 0

        // We impersonate LP token WHALE and make him a signer
        const signer = await impersonateAddress(lpTokenHolderAddress);
        await lpTokenContract.connect(signer).approve(controller.address, ONE_HUNDRED_ETHER)

        const balTokenContract = await getContract('ERC20Mock', bal);

        // root is deployer + treasury accc
        // it starts with 0 BAL balance
        const { root } = await getNamedAccounts();
        expect(await balTokenContract.balanceOf(root)).to.equals(0)

        // deposit from signer
        await expect(controller.connect(signer).deposit(pid, ONE_HUNDRED_ETHER, false)) // do not stake tokens
            .to.emit(controller, 'Deposited')
            .withArgs(signer.address, pid, ONE_HUNDRED_ETHER);

        await increaseTime(60 * 60 * 24 * 10) // 10 days

        await controller.earmarkRewards(pid)

        // Treasury (root) BAL balance should not be zero anymore
        expect(await balTokenContract.balanceOf(root)).to.not.equals(0)

        await expect(controller.connect(signer).withdraw(pid, ONE_HUNDRED_ETHER))
            .to.emit(controller, 'Withdrawn')
            .withArgs(signer.address, pid, ONE_HUNDRED_ETHER);
    })

    it("adds pool, deposits LP tokens, votes for gauge", async function () {
        await expect(controller.addPool(lpToken, gauge)).to.emit(rewardFactory, 'BaseRewardPoolCreated');
        // creates a pool with PID 0
        const pid = 0

        // We impersonate LP token WHALE and make him a signer
        const signer = await impersonateAddress(lpTokenHolderAddress);
        await lpTokenContract.connect(signer).approve(controller.address, ONE_HUNDRED_ETHER)


        // deposit from signer
        await expect(controller.connect(signer).deposit(pid, ONE_HUNDRED_ETHER, true)) // do not stake tokens
            .to.emit(controller, 'Deposited')
            .withArgs(signer.address, pid, ONE_HUNDRED_ETHER);

        // impersonate whale and send 100 BAL to voter proxy for initial lock
        const balWhaleSigner = await impersonateAddress(balWhale);
        await balTokenContract.connect(balWhaleSigner).transfer(voterProxy.address, ONE_HUNDRED_ETHER);
        expect(await balTokenContract.balanceOf(voterProxy.address)).to.equals(ONE_HUNDRED_ETHER)

        // can't lock it :(
        await expect(balDepositor.initialLock()).to.be.revertedWith('Smart contract depositors not allowed')
    })

});

