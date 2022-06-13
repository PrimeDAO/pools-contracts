const deployFunction = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { root } = await getNamedAccounts();
  
    const controller = await deployments.get('Controller');

    await deploy("TokenFactory", {
      from: root,
      args: [controller.address],
      log: true,
    });
  };
  
  module.exports = deployFunction;
  module.exports.tags = ["TokenFactory"];
  module.exports.dependencies = ['Controller'];