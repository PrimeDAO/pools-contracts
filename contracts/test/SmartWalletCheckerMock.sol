// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

contract SmartWalletCheckerMock {

    event ContractAddressAdded(address contractAddress);

    mapping(address => bool) public allowed;

    function allow(address _addr) public {
        allowed[_addr] = true;
    }

    function check(address _caller) external view returns(bool) {
        return allowed[_caller];
    }

    function allowlistAddress(address contractAddress) external {}
}