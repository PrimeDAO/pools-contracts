const { SECONDS_IN_DAY } = require("./constants");

// calculates timestamp in x days from current block timestamp
const getFutureTimestamp = async (days = 1) => {
    const currentTimeInSeconds = await getCurrentBlockTimestamp()

    return currentTimeInSeconds + (SECONDS_IN_DAY * days);
}

// returns signer for address
const impersonateAddress = async (address) => {
    await ethers.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [address],
    });
    const signer = await ethers.provider.getSigner(address);
    signer.address = signer._address;
    return signer;
};

const getCurrentBlockTimestamp = async function () {
    const blockNumBefore = await ethers.provider.getBlockNumber();
    const blockBefore = await ethers.provider.getBlock(blockNumBefore);
    return blockBefore.timestamp;
}

module.exports = {
    getFutureTimestamp,
    impersonateAddress,
    getCurrentBlockTimestamp,
}