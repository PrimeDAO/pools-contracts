// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "../BaseRewardPool.sol";

/// @dev Contract used in tests
///      so that we can test internal/private functions
contract BaseRewardPoolInTest is BaseRewardPool {

    event Result(uint256 result);

    constructor(        
        uint256 pid_,
        address stakingToken_,
        address rewardToken_,
        address operator_,
        address rewardManager_
        ) BaseRewardPool(
        pid_,
        stakingToken_,
        rewardToken_,
        operator_,
        rewardManager_){}

    function unsafeIncExternal(uint256 x) external {
        uint256 result = super.unsafeInc(x);
        emit Result(result);
    }
}