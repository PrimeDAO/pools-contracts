const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants.js");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { ONE_HUNDRED_ETHER } = require("../helpers/constants.js");
const init = require("../test-init.js");

describe("unit - Contract: D2DBal and depositToken", async () => {

    let D2DBal, depositToken, randomUser;

    const setupTests = deployments.createFixture(async () => {
        const signers = await ethers.getSigners();
        const setup = await init.initialize(signers);
        await init.getTokens(setup);

        D2DBal = setup.tokens.D2DBal
        depositToken = setup.tokens.depositToken
        randomUser = signers.pop()
    });

    beforeEach(async function () {
        await setupTests();
    });

    it('mints and burns D2DBal tokens', async function () {
        await expect(D2DBal.connect(randomUser).mint(randomUser.address, ONE_HUNDRED_ETHER))
            .to.be.revertedWith('Ownable: caller is not the owner')

        await expect(D2DBal.connect(randomUser).burn(randomUser.address, ONE_HUNDRED_ETHER))
            .to.be.revertedWith('Ownable: caller is not the owner')

        await expect(D2DBal.mint(randomUser.address, ONE_HUNDRED_ETHER)).to.emit(D2DBal, 'Transfer')
            .withArgs(ZERO_ADDRESS, randomUser.address, ONE_HUNDRED_ETHER);

        await expect(D2DBal.burn(randomUser.address, ONE_HUNDRED_ETHER)).to.emit(D2DBal, 'Transfer')
            .withArgs(randomUser.address, ZERO_ADDRESS, ONE_HUNDRED_ETHER);
    });

    it('mints and burns depositTokens', async function () {
        // root is operator for deposit token
        await expect(depositToken.connect(randomUser).mint(randomUser.address, ONE_HUNDRED_ETHER))
            .to.be.revertedWith('Unauthorized()')

        await expect(depositToken.connect(randomUser).burn(randomUser.address, ONE_HUNDRED_ETHER))
            .to.be.revertedWith('Unauthorized()')

        await expect(depositToken.mint(randomUser.address, ONE_HUNDRED_ETHER)).to.emit(depositToken, 'Transfer')
            .withArgs(ZERO_ADDRESS, randomUser.address, ONE_HUNDRED_ETHER);  

        await expect(depositToken.burn(randomUser.address, ONE_HUNDRED_ETHER)).to.emit(depositToken, 'Transfer')
            .withArgs(randomUser.address, ZERO_ADDRESS, ONE_HUNDRED_ETHER);
    });
});
