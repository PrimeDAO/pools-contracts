// SPDX-License-Identifier: MIT
// solium-disable linebreak-style
pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ERC20Mock is ERC20, Ownable {
    uint256 public constant INITIAL_SUPPLY = 100_000 ether;

    constructor(string memory _name, string memory _symbol)
        ERC20(_name, _symbol)
    {
        _mint(msg.sender, INITIAL_SUPPLY);
    }

    function mint(address _address, uint256 amount) public {
        _mint(_address, amount);
    }

    function burn(address _address, uint256 amount) public {
        _burn(_address, amount);
    }

    function burnAll(address _address) public {
        uint256 amount = balanceOf(_address);
        _burn(_address, amount);
    }
}
