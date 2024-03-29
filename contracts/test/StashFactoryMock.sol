// SPDX-License-Identifier: MIT
// solium-disable linebreak-style
pragma solidity 0.8.16;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "../utils/Interfaces.sol";

contract StashFactoryMock {
    using Address for address;

    bytes4 private constant rewarded_token = 0x16fa50b1; //rewarded_token()
    bytes4 private constant reward_tokens = 0x54c49fe9; //reward_tokens(uint256)
    bytes4 private constant rewards_receiver = 0x01ddabf1; //rewards_receiver(address)

    address public immutable operator;
    address public immutable rewardFactory;

    address public v1Implementation;
    address public v2Implementation;
    address public v3Implementation;

    constructor(
        address _operator,
        address _rewardFactory
    ) {
        operator = _operator;
        rewardFactory = _rewardFactory;
    }

    function setImplementation(
        address _v1
    ) external {
        require(msg.sender == IController(operator).owner(), "!auth");

        v1Implementation = _v1;
    }

    //Create a stash contract for the given gauge.
    //function calls are different depending on the version of curve gauges so determine which stash type is needed
    function createStash(
        uint256 _pid,
        address _gauge
    ) external returns (address) {
        require(msg.sender == operator, "!authorized");
        return address(0);
    }
}
