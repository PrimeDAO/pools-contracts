const { getAddresses } = require('../config');

const deployFunction = async ({ getNamedAccounts, deployments }) => {
    // Normally BaseRewardPool is deployed from controller when we addPool

    // Convex has 2 pools with pid 0
    // One deployed from controller https://etherscan.io/address/0xf403c135812408bfbe8713b5a23a04b3d48aae31#readContract
    // poolInfo(0) -> crvRewards

    // Another deployed manualy (this deployment script is doing that)
    // This tx is setingRewadContract on controller https://etherscan.io/tx/0x76c5a9a5e98d1c5f5d350ac8fe5d1c42e2a0d401d6392e5545b8faf3fda2325b
    // rewards address is a basereward pool deployed from deployer
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