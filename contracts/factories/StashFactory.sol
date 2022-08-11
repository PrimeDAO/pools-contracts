// SPDX-License-Identifier: MIT

/*
 * MIT License
 *
 * Copyright (c) 2021 convex-eth
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

pragma solidity 0.8.16;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "../utils/Interfaces.sol";

/// @title Stash Factory
contract StashFactory is IStashFactory {
    event ImpelemntationChanged(address _newImplementation);

    error Unauthorized();

    address public immutable operator;
    address public immutable rewardFactory;

    address public implementation;

    constructor(address _operator, address _rewardFactory) {
        operator = _operator;
        rewardFactory = _rewardFactory;
    }

    /// @notice Used to set address for new implementation contract
    /// @param _newImplementation Address of new implementation contract
    function setImplementation(address _newImplementation) external {
        if (msg.sender != IController(operator).owner()) {
            revert Unauthorized();
        }
        implementation = _newImplementation;
        emit ImpelemntationChanged(_newImplementation);
    }

    /// @notice Create a stash contract for the given gauge
    /// @param _pid The PID of the pool
    /// @param _gauge Gauge address
    function createStash(uint256 _pid, address _gauge) external returns (address) {
        if (msg.sender != operator) {
            revert Unauthorized();
        }
        address stash = Clones.clone(implementation);
        IStash(stash).initialize(_pid, msg.sender, _gauge, rewardFactory);
        return stash;
    }
}
