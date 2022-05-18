const deployFunction = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { root } = await getNamedAccounts();

    await deploy("D2DBal", {
        contract: "D2DBal",
        from: root,
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
module.exports.tags = ["D2DBal", "PoolToken"];
