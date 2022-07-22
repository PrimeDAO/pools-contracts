const { getAddresses, tags: { addPools, Controller, ControllerSetters, VoterProxySetters } } = require("../config");

const deployFunction = async ({ getNamedAccounts, deployments }) => {
    const { execute } = deployments;
    const { root } = await getNamedAccounts();

    const addresses = getAddresses();

    const pools = addresses.pools

    for (const pool of pools) {
        await execute('Controller', { from: root, log: true, gasLimit: process.env.GAS_LIMIT }, 'addPool', pool.lpToken, pool.gauge);
        console.log('Controller addPool: ', pool.name);
    }
};

module.exports = deployFunction;
module.exports.tags = [addPools];
module.exports.dependencies = [Controller, ControllerSetters, VoterProxySetters];