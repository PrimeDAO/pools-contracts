const { tags: { ControllerSetters, deployment, Controller, StashFactory, TokenFactory }, getAddresses } = require('../config');

const deployFunction = async ({ deployments }) => {
    const { execute } = deployments;
    const { root } = await getNamedAccounts();
    const addresses = getAddresses();

    const { address: rewardFactoryAddress } = await deployments.get('RewardFactory');
    const { address: stashFactoryAddress } = await deployments.get('StashFactory');
    const { address: tokenFactoryAddress } = await deployments.get('TokenFactory');

    await execute('Controller', { from: root, log: true }, 'setFactories', rewardFactoryAddress, stashFactoryAddress, tokenFactoryAddress)
    await execute('Controller', { from: root, log: true }, 'addFeeToken', addresses.bal)
    await execute('Controller', { from: root, log: true }, 'setVoteDelegate', addresses.PRIME_MULTISIG)
    await execute('Controller', { from: root, log: true }, 'setFeeManager', addresses.PRIME_MULTISIG)
    await execute('Controller', { from: root, log: true }, 'setPoolManager', addresses.PRIME_MULTISIG)
    await execute('Controller', { from: root, log: true }, 'setOwner', addresses.PRIME_MULTISIG)
    console.log('Controller setVoteDelegate: ', addresses.PRIME_MULTISIG);
    console.log('Controller setFeeManager: ', addresses.PRIME_MULTISIG);
    console.log('Controller setPoolManager: ', addresses.PRIME_MULTISIG);
    console.log('Controller setOwner: ', addresses.PRIME_MULTISIG);
    console.log('Controller addFeeToken: ', addresses.bal);

    console.log('Controller rewardFactory: ', rewardFactoryAddress);
    console.log('Controller stashFactory: ', stashFactoryAddress);
    console.log('Controller tokenFactory: ', tokenFactoryAddress);
};

module.exports = deployFunction;
module.exports.tags = [ControllerSetters, deployment];
module.exports.dependencies = [Controller, StashFactory, TokenFactory];