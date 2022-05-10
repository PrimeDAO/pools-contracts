const deployFunction = async ({ getNamedAccounts, deployments, network }) => {
  console.log(`Deploying on network ${network.name}`);
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  const decimals1 = 10; //uint8 decimals_ ; 10 for example (set correct later)
  await deploy("D2DToken", {
    contract: "D2DToken",
    from: root,
    args: [decimals1],
    log: true,
  });

  const decimals2 = 10; //uint8 decimals_ ; 10 for example (set correct later)
  await deploy("PoolToken", {
    contract: "PoolToken",
    from: root,
    args: ["Pool Token", "BALP", decimals2],
    log: true,
  });

};

module.exports = deployFunction;
module.exports.tags = ["D2DToken", "PoolToken"];
