// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

// import "./Interfaces.sol";
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import "@openzeppelin/contracts/access/Ownable.sol";


contract PoolContract is ERC20, Ownable {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public constant registry = address(0xC128a9954e6c874eA3d62ce62B468bA073093F25); //need change to actual

    address public operator;
    address public pools;

    constructor(address _pools) public {
        operator = msg.sender;
        pools = _pools;
        _transferOwnership(_msgSender()); // as PoolContract is Ownable 
    }

    function setOperator(address _operator) onlyOwner external {
        require(msg.sender == operator, "!auth");
        operator = _operator;
    }

    //revert control of adding  pools back to operator
    function revertControl() onlyOwner external{
        require(msg.sender == operator, "!auth");
        IPools(pools).setPoolManager(operator);
    }
}