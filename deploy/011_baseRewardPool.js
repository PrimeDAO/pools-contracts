const { getAddresses, tags: { BaseRewardPool, deployment, Controller, D2DBal } } = require('../config');

const deployFunction = async ({ getNamedAccounts, deployments }) => {
    // This is our cvxCRV Rewards equivalent
    const { deploy, execute } = deployments;
    const { root } = await getNamedAccounts();

    const addresses = getAddresses();

    const controller = await deployments.get('Controller');
    const d2dBal = await deployments.get('D2DBal');

    const { address: baseRewardPoolAddress } = await deploy("BaseRewardPool", {
        from: root,
        args: [0, d2dBal.address, addresses.bal, controller.address, root],
        log: true,
    });

    await execute('Controller', { from: root, log: true }, 'setRewardContracts', baseRewardPoolAddress)

    console.log('Controller setRewardContracts: ', baseRewardPoolAddress);
};

module.exports = deployFunction;
module.exports.tags = [BaseRewardPool, deployment];
module.exports.dependencies = [Controller, D2DBal];