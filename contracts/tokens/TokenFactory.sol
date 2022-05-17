// SPDX-License-Identifier: MIT
// solium-disable linebreak-style
pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./DepositToken.sol";

contract TokenFactory {
    // using Address for address;

    address public operator;
    address public token;

    constructor(address _operator) public {
        operator = _operator;
    }

    function CreateDepositToken(address _lptoken) external returns(address){
        // require(msg.sender == operator, "!authorized");

        DepositToken dtoken = new DepositToken(operator,_lptoken);
        token = address(dtoken);
        return address(dtoken);
    }
        //Create a stash contract for the given gauge.
    //function calls are different depending on the version of curve gauges so determine which stash type is needed
    function CreateStash(uint256 _pid, address _gauge, address _staker, uint256 _stashVersion) external returns(address){
        return token;
    }

    // for addPool IStaker(staker).setStashAccess(stash, true);
    function setStashAccess(address, bool) external {

    }
}
