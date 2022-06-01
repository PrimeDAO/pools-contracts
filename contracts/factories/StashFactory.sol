// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "../utils/Interfaces.sol";

/// @title Stash Factory
contract StashFactory {
    event ImpelemntationChanged(address _newImplementation);

    error Unauthorized();

    address public immutable operator;
    address public immutable rewardFactory;
    address public immutable proxyFactory;

    address public implementation;

    constructor(
        address _operator,
        address _rewardFactory,
        address _proxyFactory
    ) public {
        operator = _operator;
        rewardFactory = _rewardFactory;
        proxyFactory = _proxyFactory;
    }

    /// @notice Used to set address for new implementation contract
    /// @param _newImplementation Address of new implementation contract
    function setImplementation(address _newImplementation) external {
        if (msg.sender != IDeposit(operator).owner()) {
            revert Unauthorized();
        }
        implementation = _newImplementation;
        emit ImpelemntationChanged(_newImplementation);
    }

    /// @notice Create a stash contract for the given gauge
    /// @param _pid The PID of the pool
    /// @param _gauge Gauge address
    /// @param _staker Staker's address
    function createStash(
        uint256 _pid,
        address _gauge,
        address _staker
    ) external returns (address) {
        if (msg.sender != operator) {
            revert Unauthorized();
        }
        address stash = IProxyFactory(proxyFactory).clone(implementation);
        IStash(stash).initialize(_pid, operator, _staker, _gauge, rewardFactory);
        return stash;
    }
}
