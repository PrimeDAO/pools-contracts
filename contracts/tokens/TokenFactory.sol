// necessary for setFactories in Controller test
// SPDX-License-Identifier: MIT
// solium-disable linebreak-style
pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./D2DToken.sol";
import "hardhat/console.sol";

contract TokenFactory {
    // using Address for address;

    address public operator;

    constructor(address _operator) public {
        operator = _operator;
    }

    function CreateDepositToken(address _lptoken) external returns(address){
        // require(msg.sender == operator, "!authorized");

        D2DBAL dtoken = new D2DBAL();
        console.log(address(dtoken));
        // console.log(dtoken);

        return address(dtoken);
    }
}