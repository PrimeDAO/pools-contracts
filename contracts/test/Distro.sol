// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../utils/Interfaces.sol";

contract Distro is ERC20 {

    address immutable TOKEN; 

    constructor(
        address token_addr
    ) ERC20("Distro", "Distro")
    public {
        /**
        @notice Distro constructor
        @param token_addr BAL token address
        */
        uint256 _decimals = ERC20(token_addr).decimals();
        require(_decimals <= 255, "BalMock: _decimals > 255");
        TOKEN = token_addr;
    }

    // solhint-disable-next-line no-empty-blocks
    function claim() external {}
    
    function token() external view returns (address) {
        return TOKEN;
    }
}
