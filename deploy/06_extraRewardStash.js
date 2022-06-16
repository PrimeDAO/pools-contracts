const { getAddresses, tags: { ExtraRewardStash, deployment } } = require("../config");

const deployFunction = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  const addresses = getAddresses();

  await deploy("ExtraRewardStash", {
    from: root,
    args: [addresses.bal],
    log: true,
  });
};

module.exports = deployFunction;
module.exports.tags = [ExtraRewardStash, deployment];