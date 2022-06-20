const { expect } = require("chai");
const { deployments } = require("hardhat");
const { ONE_HUNDRED_ETHER } = require("../helpers/constants");
const { getContract, impersonateAddress } = require("../helpers/helpers");
const { getAddresses } = require('../../config');
const { wethBal } = getAddresses()

const lpTokenWbtcWeth = '0x647c1fd457b95b75d0972ff08fe01d7d7bda05df' // LP TOKEN Balancer 50 WBTC 50 WETH 
const gaugeWbtcWeth = '0xE190E5363C925513228Bf25E4633C8cca4809C9a' // Gauge for pool 50WBTC 50WETH


/*
                                        IMPORTANT
        In this test we are using already deployed smart contracts on Kovan that have permission
        to interact with Balancer's veBal, we are pinned on certain block number (see hardhat.config.js)
*/

describe("Kovan integration with deployed contracts", function () {

    let voterProxy, d2DBal, balDepositor, controller, wethBalContract, rewardFactory, lpTokenContract;

    const setupTests = deployments.createFixture(async () => {
        voterProxy = await getContract('VoterProxy', require('../../deployments/kovan/VoterProxy.json').address)
        d2DBal = await getContract('D2DBal', require('../../deployments/kovan/D2DBal.json').address)
        balDepositor = await getContract('BalDepositor', require('../../deployments/kovan/BalDepositor.json').address)
        controller = await getContract('Controller', require('../../deployments/kovan/Controller.json').address)
        wethBalContract = await getContract('ERC20Mock', wethBal)
        rewardFactory = await getContract('RewardFactory', require('../../deployments/kovan/RewardFactory.json').address)
        lpTokenContract = await getContract('ERC20Mock', lpTokenWbtcWeth)
    });

    beforeEach(async function () {
        // skip test if we're not on kovan fork
        if (process.env.BLOCKCHAIN_FORK !== 'kovan') {
            this.skip();
        }
        await setupTests();
    });
    
    it("It deposit and withdraw WethBal", async () => {
        await expect(controller.addPool(lpTokenWbtcWeth, gaugeWbtcWeth)).to.emit(rewardFactory, 'BaseRewardPoolCreated');
        expect(await controller.poolLength()).to.equals(1);
        const pid = 0;

        // We impersonate LP token WHALE and make him a signer
        const signer = await impersonateAddress(lpTokenHolderAddress);

        await initialLockWethBal(wethBalContract, balDepositor, voterProxy)

        await lpTokenContract.connect(signer).approve(controller.address, ONE_HUNDRED_ETHER)
        await wethBalContract.connect(signer).approve(balDepositor.address, ONE_HUNDRED_ETHER)

        const before = (await wethBalContract.balanceOf(balDepositor.address)).toNumber()
        const depositAmount = ONE_HUNDRED_ETHER;
        await expect(balDepositor.deposit(depositAmount, false, baseRewardPool.address))

        const after = before.add(ONE_HUNDRED_ETHER.toNumber())
        await expect(wethBalContract.balanceOf(balDepositor.address)).to.equals(after)

        await increaseTime(60 * 60 * 24 * 365) // 365 days

        await expect(controller.connect(root).withdrawUnlockedWethBal(pid, ONE_HUNDRED_ETHER))
        expect(
            (await wethBalContract.balanceOf(treasury.address)).toNumber()
        ).to.equal(ONE_HUNDRED_ETHER.toNumber());
    })
});

const initialLockWethBal = async function (wethBalContract, balDepositor, voterProxy) {
    const wethBalWhaleSigner = await impersonateAddress('0x77777512272eda91589b62fc8506e607dea0bb08')

    await wethBalContract.connect(wethBalWhaleSigner).transfer(voterProxy.address, ONE_HUNDRED_ETHER);

    expect(await wethBalContract.balanceOf(voterProxy.address)).to.equals(ONE_HUNDRED_ETHER)

    await balDepositor.initialLock()
}