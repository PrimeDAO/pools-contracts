const deployFunction = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  const decimals1 = 18; //uint8 decimals_ ; 10 for example (set correct later)
  await deploy("D2DToken", {
    contract: "D2DToken",
    from: root,
    args: [decimals1],
    log: true,
  });

  await deploy("PoolToken", {
    contract: "ERC20Mock",
    from: root,
    args: ["Pool Token", "BALP"],
    log: true,
  });

};

module.exports = deployFunction;
module.exports.tags = ["D2DToken", "PoolToken"];
