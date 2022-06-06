const { getContract } = require('../test/helpers/helpers');

const deployFunction = async ({ deployments }) => {
    const { address: controllerAddress } = await deployments.get('Controller');
    const controller = await getContract('Controller', controllerAddress)
    
    const { address: rewardFactoryAddress } = await deployments.get('RewardFactory');
    const { address: stashFactoryAddress } = await deployments.get('StashFactory');
    const { address: tokenFactoryAddress } = await deployments.get('TokenFactory');

    await controller.setFactories(rewardFactoryAddress, stashFactoryAddress, tokenFactoryAddress);

    console.log('Controller rewardFactory: ', rewardFactoryAddress);
    console.log('Controller stashFactory: ', stashFactoryAddress);
    console.log('Controller tokenFactory: ', tokenFactoryAddress);
};

module.exports = deployFunction;
module.exports.tags = ["ControllerSetters"];
module.exports.dependencies = ['Controller'];