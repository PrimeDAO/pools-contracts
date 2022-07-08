// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

contract ExternalContractMock {

    event Yay(uint256 number);

    function works(uint256 _number) external {
        emit Yay(_number);
    }
}