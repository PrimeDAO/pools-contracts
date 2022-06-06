// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract DepositToken is ERC20 {
    error Unauthorized();

    address public immutable operator;

    constructor(address _operator, address _lptoken)
        ERC20(
            string(abi.encodePacked("D2D ", ERC20(_lptoken).name())),
            string(abi.encodePacked("d2d ", ERC20(_lptoken).symbol()))
        )
    {
        operator = _operator;
    }

    function mint(address _to, uint256 _amount) external {
        if (msg.sender != operator) {
            revert Unauthorized();
        }
        _mint(_to, _amount);
    }

    function burn(address _from, uint256 _amount) external {
        if (msg.sender != operator) {
            revert Unauthorized();
        }
        _burn(_from, _amount);
    }
}
