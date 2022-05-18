const { expect } = require("chai");
const { deployments, ethers } = require("hardhat");
const init = require("../test-init.js");

describe("VoterProxy", function () {
    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();

        const setup = await init.initialize(await ethers.getSigners());
        
        await init.getTokens(setup);

        const voterProxy = await init.getVoterProxy(setup);

        return {
            voterProxy,
        }
    });

    // TODO: uncomment after MINTR mock PR is merged
    // before('!! setup', async function() {
    //     const { voterProxy } = await setupTests();

    //     expect(await voterProxy.getName()).to.equal('PrimeVoterProxy')
    // });

    it('TODO', async function() {
        expect(true).to.equal(true);
    });
});
