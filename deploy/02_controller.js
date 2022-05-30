const deployFunction = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  const voterProxy = await deployments.get('VoterProxy');

  await deploy("Controller", {
    from: root,
    args: [voterProxy.address],
    log: true,
  });
};

module.exports = deployFunction;
module.exports.tags = ["Controller"];
module.exports.dependencies = ['VoterProxy'];