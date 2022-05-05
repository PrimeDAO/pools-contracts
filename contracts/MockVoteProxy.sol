//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

//import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockVoteProxy {
    address public owner;

    constructor() {
        owner = msg.sender;
  
    }

}