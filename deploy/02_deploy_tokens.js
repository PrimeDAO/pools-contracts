const deployFunction = async ({ getNamedAccounts, deployments, network }) => {
  console.log(`Deploying on network ${network.name}`);
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  await deploy("D2DToken", {
    contract: "D2DToken",
    from: root,
    args: [10], //uint8 decimals_ ; 10 for example (set correct later)
    log: true,
  });

  await deploy("PoolContract", {
    contract: "PoolContract",
    from: root,
    args: ["Pool Contract", "BALP", 10], //decimals_; 10 for example (set correct later)
    log: true,
  });
};

module.exports = deployFunction;
module.exports.tags = ["D2DToken", "PoolContract"];
