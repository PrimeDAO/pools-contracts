const { assert } = require("chai");
const { constants } = require("@openzeppelin/test-helpers");
const { deployments, ethers } = require("hardhat");
const init = require("../test-init.js");

describe("BalDepositor", function () {

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        const signers = await ethers.getSigners();

        const setup = await init.initialize(await ethers.getSigners());

        await init.getTokens(setup);

        const tokens = await init.getTokens(setup);

        const balDepositor = await init.balDepositor(setup);

        return {
            balDepositor,
            tokens,            
            roles: setup.roles,
            randomUser: signers.pop(),
        }
    });

    // first deployment test
    it("checks if deployed contracts are ZERO_ADDRESS", async () => {
        const { balDepositor, tokens } = await setupTests();

        assert(balDepositor.address != constants.ZERO_ADDRESS);
        assert(tokens.WethBal.address != constants.ZERO_ADDRESS);
        assert(tokens.D2DBal.address != constants.ZERO_ADDRESS);
        assert(tokens.VeBal.address != constants.ZERO_ADDRESS);
    });

    it("checks BalDepositor construtor", async () => {
        const { balDepositor, tokens, roles } = await setupTests();

        const wethBalAdress = await balDepositor.wethBal();
        const staker = await balDepositor.staker();
        const minter = await balDepositor.minter();
        const escrow =  await balDepositor.escrow();

        assert(wethBalAdress == tokens.WethBal.address);
        assert(staker == roles.staker.address);
        assert(minter == tokens.D2DBal.address);
        assert(escrow == tokens.VeBal.address);
    });

});