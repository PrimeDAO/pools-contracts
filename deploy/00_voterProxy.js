const { getAddresses } = require('../config')

const deployFunction = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { root } = await getNamedAccounts();

    const addresses = getAddresses();

    await deploy("VoterProxy", {
        from: root,
        args: [addresses.minter, addresses.bal, addresses.veBal, addresses.gaugeController],
        log: true
    });
};

module.exports = deployFunction;
module.exports.tags = ["VoterProxy"];