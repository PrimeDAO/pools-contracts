
pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

//this is a mock weth/bal token contract


contract MockD2DBal is ERC20 {
    uint256 public constant initialSupply = 20000000000000000000000;
    
    constructor() ERC20("MockD2DBal", "D2D") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}