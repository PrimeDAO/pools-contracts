// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "../utils/Interfaces.sol";

contract BaseRewardPoolMock {
    function callWithdrawToOnController(address controller, uint256 pid, uint256 amount) external {
        IController(controller).withdrawTo(pid, amount, msg.sender);
    }
}