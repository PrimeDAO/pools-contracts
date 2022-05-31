// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

import "../utils/Interfaces.sol";

contract ControllerMock is IDeposit {

    event StashCreated();

    address public lockRewards;

    address public owner;

    constructor() {
        owner = msg.sender;
    }

    function isShutdown() external view returns (bool) {
        return false;
    }

    function balanceOf(address _account) external view returns (uint256) {
        return 0;
    }

    function totalSupply() external view returns (uint256) {
        return 0;
    }

    function poolInfo(uint256)
        external
        view
        returns (
            address,
            address,
            address,
            address,
            address,
            bool
        ) {
            return (address(0), address(0), address(0), address(0), address(0), false);
        }

    function rewardClaimed(
        uint256,
        address,
        uint256
    ) external {}

    function withdrawTo(
        uint256,
        uint256,
        address
    ) external {}

    function claimRewards(uint256, address) external returns (bool) {
        return false;
    }

    function rewardArbitrator() external returns (address) {
        return address(0);
    }

    function setGaugeRedirect(uint256 _pid) external returns (bool) {
        return false;
    }

    function queueNewRewards(uint256 _rewards) external {
        IRewards(lockRewards).queueNewRewards(_rewards);
    }

    function createStash(address _stash) external {
        address createdStash = IStashFactory(_stash).createStash(
            1,
            address(0),
            address(0)
        );

        emit StashCreated();
    }

    function setRewardContracts(address _rewards) external {
        lockRewards = _rewards;
    }
}