const { expect } = require("chai");
const { deployments } = require("hardhat");
const { ONE_HUNDRED_ETHER } = require("../helpers/constants");
const { getContract, impersonateAddress } = require("../helpers/helpers");
const { getAddresses } = require('../../config');
const { wethBal } = getAddresses()

const gauge = '0xE190E5363C925513228Bf25E4633C8cca4809C9a' // Gauge for pool 50WBTC 50WETH
const gaugeTwo = '0x5E7B7B41377Ce4B76d6008F7a91ff9346551c853' // Gauge for pool 17WBTC-50BAL-33USDC


/*
                                        IMPORTANT
        In this test we are using already deployed smart contracts on Kovan that have permission
        to interact with Balancer's veBal, we are pinned on certain block number (see hardhat.config.js)
*/

describe("Kovan integration with deployed contracts", function () {

    let voterProxy, balDepositor, controller, wethBalContract, gaugeController;

    const setupTests = deployments.createFixture(async () => {
        voterProxy = await getContract('VoterProxy', require('../../deployments/kovan/VoterProxy.json').address)
        gaugeController = await getContract('GaugeControllerMock', await voterProxy.gaugeController())
        balDepositor = await getContract('BalDepositor', require('../../deployments/kovan/Baldepositor.json').address)
        controller = await getContract('Controller', require('../../deployments/kovan/Controller.json').address)
        wethBalContract = await getContract('ERC20Mock', wethBal)
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
        await initialLockWethBal(wethBalContract, balDepositor, voterProxy)

        const pid = 0;
        
        await lpTokenContract.connect(signer).approve(controller.address, ONE_HUNDRED_ETHER)
        await wethBalContract.connect(signer).approve(balDepositor.address, ONE_HUNDRED_ETHER)

        const before = (await wethBalContract.balanceOf(balDepositor.address)).toNumber()
        const depositAmount = ONE_HUNDRED_ETHER;
        expect(await balDepositor.deposit(depositAmount, false, baseRewardPool.address))

        const after = before.add(ONE_HUNDRED_ETHER.toNumber())
        expect(await wethBalContract.balanceOf(balDepositor.address)).to.equals(after)

        await increaseTime(60 * 60 * 24 * 365) // 365 days

        expect(await controller.connect(root).withdrawUnlockedWethBal(pid, ONE_HUNDRED_ETHER))
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