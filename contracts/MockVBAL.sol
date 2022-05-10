//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./SampleERC.sol";

contract MockVBAL is ERC20 {
    uint256 public theNewSupply = 20000000000000000000000;
    SampleERC public coin;
    address public owner;
    mapping(address => uint) public deposits;
    
    modifier onlyOwner(){
        require(owner == msg.sender, "Only owner");
        _;
    }
    constructor() ERC20("Vebal", "VBL") {}

    function setCoinAddress(SampleERC _coin) external {
       require(address(coin) == address(0x0), "WRITE_ONCE");
        coin = _coin;
    }

    function increaseAmount(address _addr, uint256 _amount) external {
        coin.transferFrom(_addr, address(this), _amount);
        emit NewDeposit(_addr, _amount);
    }

    function increase_unlock_time(uint256 amount) external {
       
    }

    function withdraw() external {
        
    }

    function create_lock(uint256 amount, uint256 _unlock_time) external {
        
    }

    //Have to also set the coin address in this contract

    event NewDeposit(address from, uint256 amount);

}