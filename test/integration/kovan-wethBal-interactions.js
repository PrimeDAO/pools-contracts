const { expect } = require("chai");
const { deployments } = require("hardhat");
const { ONE_HUNDRED_ETHER } = require("../helpers/constants");
const { getContract, impersonateAddress } = require("../helpers/helpers");
const { getAddresses } = require('../../config');
const { wethBal } = getAddresses()

const lpTokenWbtcWeth = '0x647c1fd457b95b75d0972ff08fe01d7d7bda05df' // LP TOKEN Balancer 50 WBTC 50 WETH 
const lpTokenHolderAddress = '0x79613fb99098089e454ca2439eca452d3740391f' // LP token Whale that we impersonate
const pid = 0

/*
                                        IMPORTANT
        In this test we are using already deployed smart contracts on Kovan that have permission
        to interact with Balancer's veBal, we are pinned on certain block number (see hardhat.config.js)
*/

describe("Kovan integration with deployed contracts", function () {

    let voterProxy, balDepositor, controller, wethBalContract, lpTokenContract;

    const setupTests = deployments.createFixture(async () => {
        voterProxy = await getContract('VoterProxy', require('../../deployments/kovan/VoterProxy.json').address)
        balDepositor = await getContract('BalDepositor', require('../../deployments/kovan/BalDepositor.json').address)
        controller = await getContract('Controller', require('../../deployments/kovan/Controller.json').address)
        wethBalContract = await getContract('ERC20Mock', wethBal)
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
        const { treasury } = await getNamedAccounts();

        const signer = await impersonateAddress(lpTokenHolderAddress);
        await lpTokenContract.connect(signer).approve(controller.address, ONE_HUNDRED_ETHER)
        const wethBalWhaleSigner = await impersonateAddress('0x77777512272eda91589b62fc8506e607dea0bb08')
        await wethBalContract.connect(wethBalWhaleSigner).transfer(voterProxy.address, ONE_HUNDRED_ETHER);
        expect(await wethBalContract.balanceOf(voterProxy.address)).to.equals(ONE_HUNDRED_ETHER)
        expect(await wethBalContract.balanceOf(treasury)).to.equals(0)

        // set treasury
        await expect(controller.setTreasury(treasury))
            .to.emit(controller, 'TreasuryChanged')
            .withArgs(treasury);
        await wethBalContract.connect(wethBalWhaleSigner).approve(balDepositor.address, ONE_HUNDRED_ETHER)

        // deposit from signer
        await expect(controller.connect(wethBalWhaleSigner).deposit(pid, ONE_HUNDRED_ETHER, false)) // do not stake tokens
            .to.emit(controller, 'Deposited')
            .withArgs(wethBalWhaleSigner.address, pid, ONE_HUNDRED_ETHER);

        await increaseTime(60 * 60 * 24 * 365) // 365 days

        expect(await controller.withdrawUnlockedWethBal(ONE_HUNDRED_ETHER))
        expect(
            (await wethBalContract.balanceOf(treasury.address)).toNumber()
        ).to.equal(ONE_HUNDRED_ETHER.toNumber());
    })
});
