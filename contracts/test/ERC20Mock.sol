// SPDX-License-Identifier: MIT
// solium-disable linebreak-style
pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20Mock is ERC20 {
    uint256 public constant INITIAL_SUPPLY = 20000 ether;

    constructor(string memory _name, string memory _symbol)
        ERC20(_name, _symbol)
    {
        _mint(msg.sender, INITIAL_SUPPLY);
    }

    function mint(address _to, uint256 _amount) external {
        _mint(_to, _amount);
    }
}
