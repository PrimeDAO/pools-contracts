const { getAddresses } = require('../config');

const deployFunction = async ({ getNamedAccounts, deployments }) => {
    // This is our cvxCRV Rewards equivalent
    const { deploy, execute } = deployments;
    const { root } = await getNamedAccounts();

    const addresses = getAddresses();

    const controller = await deployments.get('Controller');
    const d2dBal = await deployments.get('D2DBal');
    const rewardFactory = await deployments.get('RewardFactory');

    const { address: baseRewardPoolAddress } = await deploy("BaseRewardPool", {
        from: root,
        args: [0, d2dBal.address, addresses.bal, controller.address, rewardFactory.address],
        log: true,
    });

    await execute('Controller', { from: root, log: true }, 'setRewardContracts', baseRewardPoolAddress)

    console.log('Controller setRewardContracts: ', baseRewardPoolAddress);
};

module.exports = deployFunction;
module.exports.tags = ["BaseRewardPool"];
module.exports.dependencies = ['Controller', 'D2DBal', 'RewardFactory'];