// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "../utils/Interfaces.sol";

contract StashMock is IStash {
    // solhint-disable-next-line
    function stashRewards() external returns (bool) {}
    // solhint-disable-next-line
    function processStash() external returns (bool) {}
    // solhint-disable-next-line
    function claimRewards() external returns (bool) {}

    function initialize(
        uint256 _pid,
        address _operator,
        address _staker,
        address _gauge,
        address _rewardFactory
    // solhint-disable-next-line
    ) external {}
}