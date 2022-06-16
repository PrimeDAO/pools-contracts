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

    it("votes for gauge weight", async function () {
        await initialLockWethBal(wethBalContract, balDepositor, voterProxy)

        // try to vote with too big weight
        await expect(controller.voteGaugeWeight([gauge], [100000])).to.be.revertedWith('You used all your voting power')
        
        const weightBefore = await gaugeController.get_gauge_weight(gauge)
        const weightBeforeGaugeTwo = await gaugeController.get_gauge_weight(gaugeTwo)

        // if no revert, it is success
        await controller.voteGaugeWeight([gauge, gaugeTwo], [1000, 9000])

        const weightAfter = await gaugeController.get_gauge_weight(gauge)
        const weightAfterGaugeTwo = await gaugeController.get_gauge_weight(gaugeTwo)

        // expect gauge weights to be increased
        expect(weightAfter).to.be.gt(weightBefore)
        expect(weightAfterGaugeTwo).to.be.gt(weightBeforeGaugeTwo)
    })
});

const initialLockWethBal = async function (wethBalContract, balDepositor, voterProxy) {
    const wethBalWhaleSigner = await impersonateAddress('0x77777512272eda91589b62fc8506e607dea0bb08')

    await wethBalContract.connect(wethBalWhaleSigner).transfer(voterProxy.address, ONE_HUNDRED_ETHER);

    expect(await wethBalContract.balanceOf(voterProxy.address)).to.equals(ONE_HUNDRED_ETHER)

    await balDepositor.initialLock()
}