// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "../utils/Interfaces.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DistroMock is IFeeDistro {
    // solhint-disable-next-line
    function claimToken(address user, IERC20 token) external pure returns (uint256) {
        return 0;
    }
    // solhint-disable-next-line
    function claimTokens(address user, IERC20[] calldata tokens) external pure returns (uint256[] memory) {
        uint256[] memory res;
        return res;
    }
}