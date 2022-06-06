const { SECONDS_IN_DAY } = require("./constants");

/// Increases blockchain timestamp by value of `seconds`
async function increaseTime(value) {
    if (!ethers.BigNumber.isBigNumber(value)) {
        value = ethers.BigNumber.from(value);
    }
    await ethers.provider.send('evm_increaseTime', [value.toNumber()]);
    await ethers.provider.send('evm_mine');
}

// calculates timestamp in x days
const getFutureTimestamp = (days = 1) => {
    const oneYearFromNow = new Date();
    oneYearFromNow.setSeconds(oneYearFromNow.getSeconds() + (SECONDS_IN_DAY * days));

    // getTime() returns milliseconds
    return Math.round(oneYearFromNow.getTime() / 1000)
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

module.exports = {
    increaseTime,
    getFutureTimestamp,
    impersonateAddress,
}