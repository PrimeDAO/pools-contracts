//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./SampleERC.sol";

contract MockVBAL is ERC20 {
    SampleERC public coin;
    address public owner;
    mapping(address => uint) public deposits;
    
    modifier onlyOwner(){
        require(owner == msg.sender, "Only owner");
        _;
    }
    constructor() ERC20("Spacecoin", "SPC") {
        owner = msg.sender;
        _mint(msg.sender, 500000 * (10 ** decimals()));

    }

    function setCoinAddress(SampleERC _coin) external {
        require(address(coin) == address(0x0), "WRITE_ONCE");
        coin = _coin;
    }

    function deposit_for(address _addr, uint256 _amount) external {
        coin.transferFrom(msg.sender, address(this), _amount);
        emit NewDeposit(_addr, _amount);
    }

    event NewDeposit(address from, uint256 amount);

}