// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// TODO: should we maybe use https://docs.openzeppelin.com/contracts/4.x/api/token/erc20#ERC20Permit ?
/// @title D2DBal token
/// @dev Ownership is transfered to BalDepositor smart contract after it is deployed
contract D2DBal is ERC20, Ownable {
    // solhint-disable-next-line
    constructor() ERC20("D2DBal", "D2DBAL") {}

    function mint(address _to, uint256 _amount) public onlyOwner {
        _mint(_to, _amount);
    }

    function burn(address _from, uint256 _amount) public onlyOwner {
        _burn(_from, _amount);
    }
}
