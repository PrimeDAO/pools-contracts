const deployFunction = async ({ getNamedAccounts, deployments, ethers }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();
  // const safeInstance =
  //   network.name == "kovan" ? root : await ethers.getContract("VoterProxy");

  let minter;
  let bal = await ethers.getContract("D2DToken");
  let veBal = await deploy("veBalMock", {
    from: root,
    args: [
      bal.address,
      "veBalMock",
      "VBM",
      "0xEFc3a819695932394D89b8AF6f49e0D89EDf9A40", // TODO: change with authorizer adapter
    ],
    log: true,
  });
  let gaugeController;

  const { address: seedAddress } = await deploy("VoterProxy", {
    from: root,
    args: ["0xEFc3a819695932394D89b8AF6f49e0D89EDf9A40", bal.address, veBal.address, "0xEFc3a819695932394D89b8AF6f49e0D89EDf9A40"],// TODO: change with minter and gauge controller
    log: true,
  });
};

module.exports = deployFunction;
module.exports.tags = ["VoterProxy"];
