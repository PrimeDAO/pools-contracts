// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

contract SmartWalletCheckerMock {

    mapping(address => bool) public allowed;

    function allow(address _addr) public {
        allowed[_addr] = true;
    }

    function check(address _caller) external view returns(bool) {
        return allowed[_caller];
    }
}