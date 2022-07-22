const { getAddresses, tags: {VoterProxy, deployment } } = require('../config')

const deployFunction = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { root } = await getNamedAccounts();

    const addresses = getAddresses();

    await deploy("VoterProxy", {
        from: root,
        args: [addresses.minter, addresses.bal, addresses.wethBal, addresses.veBal, addresses.gaugeController],
        log: true,
        gasLimit: process.env.GAS_LIMIT,
    });
};

module.exports = deployFunction;
module.exports.tags = [VoterProxy, deployment];