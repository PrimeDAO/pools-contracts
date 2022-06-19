const { getAddresses, tags: { VoterProxySetters, deployment, VoterProxy } } = require('../config');

const deployFunction = async ({ deployments }) => {
    const { root } = await getNamedAccounts();
    const { execute } = deployments;
    const opts = { from: root, log: true }

    // set set operator to controller smart contract
    const { address: controllerAddress } = await deployments.get('Controller');

    await execute('VoterProxy', opts, 'setOperator', controllerAddress)
    console.log(`VoterProxy setOperator set to: ${controllerAddress}`)

    // set depositor to balDepositor smart contract
    const { address: balDepositor } = await deployments.get('BalDepositor');
    await execute('VoterProxy', opts, 'setDepositor', balDepositor)
    console.log(`VoterProxy setDepositor set to: ${balDepositor}`)

    // set owner to multisig smart contract
    const addresses = getAddresses();
    const multisig = addresses['PRIME_MULTISIG'];

    await execute('VoterProxy', opts, 'setOwner', multisig)
    console.log(`VoterProxy setOwner set to: ${multisig}`)
};

module.exports = deployFunction;
module.exports.tags = [VoterProxySetters, deployment];
module.exports.dependencies = [VoterProxy];