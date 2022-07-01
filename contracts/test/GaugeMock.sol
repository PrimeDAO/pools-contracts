// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

import "../utils/Interfaces.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract GaugeMock is IBalGauge {

    IERC20 public lpToken;

    constructor(address _lpToken) {
        lpToken = IERC20(_lpToken);
    }

    function deposit(uint256 _amount) external {
        lpToken.transferFrom(msg.sender, address(this), _amount);
    }

    function balanceOf(address) external view returns (uint256) {
        return 100 ether;
    }

    function withdraw(uint256 _amount) external {
        lpToken.transfer(msg.sender, _amount);
    }

    function claim_rewards() external {

    }

    function reward_tokens(uint256) external view returns (address) {
        return address(lpToken);
    } //v2

    function rewarded_token() external view returns (address) {
        return address(0);
    } //v1

    function lp_token() external view returns (address) {
        return address(0);
    }

    function set_rewards_receiver(address) external view returns(bool, bytes memory) {
        return (true, new bytes(0));
    }
}