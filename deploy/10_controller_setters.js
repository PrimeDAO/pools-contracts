const { tags: { ControllerSetters, deployment, Controller, StashFactory, TokenFactory } } = require('../config');

const deployFunction = async ({ deployments }) => {
    const { execute } = deployments;
    const { root } = await getNamedAccounts();

    const { address: rewardFactoryAddress } = await deployments.get('RewardFactory');
    const { address: stashFactoryAddress } = await deployments.get('StashFactory');
    const { address: tokenFactoryAddress } = await deployments.get('TokenFactory');

    await execute('Controller', { from: root, log: true }, 'setFactories', rewardFactoryAddress, stashFactoryAddress, tokenFactoryAddress)

    console.log('Controller rewardFactory: ', rewardFactoryAddress);
    console.log('Controller stashFactory: ', stashFactoryAddress);
    console.log('Controller tokenFactory: ', tokenFactoryAddress);
};

module.exports = deployFunction;
module.exports.tags = [ControllerSetters, deployment];
module.exports.dependencies = [Controller, StashFactory, TokenFactory];