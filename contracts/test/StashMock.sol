// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "../utils/Interfaces.sol";

contract StashMock is IStash {

    uint256 public pid;
    address public operator;
    address public staker;
    address public gauge;
    address public rewardFactory;

    // solhint-disable-next-line
    function processStash_WfQ() external {}
    // solhint-disable-next-line
    function claimRewards_6H10() external {
        IController(operator).claimRewards_poF(pid, gauge);
    }

    function initialize(
        uint256 _pid,
        address _operator,
        address _gauge,
        address _rewardFactory
    ) external {
        pid = _pid;
        operator = _operator;
        gauge = _gauge;
        rewardFactory = _rewardFactory;
    }
}