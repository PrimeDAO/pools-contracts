// SPDX-License-Identifier: MIT
// solium-disable linebreak-style
pragma solidity 0.8.13;

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
    address public immutable proxyFactory;

    address public v1Implementation;
    address public v2Implementation;
    address public v3Implementation;

    constructor(
        address _operator,
        address _rewardFactory,
        address _proxyFactory
    ) public {
        operator = _operator;
        rewardFactory = _rewardFactory;
        proxyFactory = _proxyFactory;
    }

    function setImplementation(
        address _v1,
        address _v2,
        address _v3
    ) external {
        require(msg.sender == IDeposit(operator).owner(), "!auth");

        v1Implementation = _v1;
        v2Implementation = _v2;
        v3Implementation = _v3;
    }

    //Create a stash contract for the given gauge.
    //function calls are different depending on the version of curve gauges so determine which stash type is needed
    function CreateStash(
        uint256 _pid,
        address _gauge,
        address _staker,
        uint256 _stashVersion
    ) external returns (address) {
        require(msg.sender == operator, "!authorized");
        return address(this);
    }

    function IsV1(address _gauge) private returns (bool) {

        return true;
    }

    function IsV2(address _gauge) private returns (bool) {

        return true;
    }

    function IsV3(address _gauge) private returns (bool) {

        return true;
    }

    // from Stash.sol
    function stashRewards() external pure returns (bool) {
        //after depositing/withdrawing, extra incentive tokens are claimed
        //but from v3 this is default to off, and this stash is the reward receiver too.

        return true;
    }
}