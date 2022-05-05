//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract SampleERC is ERC20 {
    address public owner;

    constructor() ERC20("Spacecoin", "SPC") {
        owner = msg.sender;
        _mint(msg.sender, 500000 * (10 ** decimals()));
    }

}