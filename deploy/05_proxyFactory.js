const deployFunction = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  await deploy("ProxyFactory", {
    from: root,
    log: true,
  });
};

module.exports = deployFunction;
module.exports.tags = ["ProxyFactory"];