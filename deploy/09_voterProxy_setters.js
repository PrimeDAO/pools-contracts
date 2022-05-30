const { getAddresses } = require('../config')

const deployFunction = async ({ deployments }) => {
    const { address: voterProxyAddress } = await deployments.get('VoterProxy');    
    const voterProxyFactory = await ethers.getContractFactory('VoterProxy')
    const voterProxy = voterProxyFactory.attach(voterProxyAddress)

    // set set operator to controller smart contract
    const { address: controllerAddress } = await deployments.get('Controller');

    await voterProxy.setOperator(controllerAddress)

    console.log(`VoterProxy setOperator set to: ${controllerAddress}`)
    
    // set depositor to balDepositor smart contract
    const { address: balDepositor } = await deployments.get('BalDepositor');
    await voterProxy.setDepositor(balDepositor)

    console.log(`VoterProxy setDepositor set to: ${balDepositor}`)

    // set owner to multisig smart contract
    const addresses = getAddresses();
    const multisig = addresses['PRIME_MULTISIG'];

    await voterProxy.setOwner(multisig)

    console.log(`VoterProxy setOwner set to: ${multisig}`)
};

module.exports = deployFunction;
module.exports.tags = ["VoterProxySetters"];
module.exports.dependencies = ['VoterProxy'];