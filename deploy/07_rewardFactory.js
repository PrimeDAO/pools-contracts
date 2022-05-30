const { getAddresses } = require('../config')

const deployFunction = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  const addresses = getAddresses();

  const voterProxy = await deployments.get('VoterProxy');

  await deploy("RewardFactory", {
    from: root,
    args: [voterProxy.address, addresses.bal],
    log: true,
  });
};

module.exports = deployFunction;
module.exports.tags = ["RewardFactory"];
module.exports.dependencies = ['VoterProxy'];