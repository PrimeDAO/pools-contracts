//mock of bal contract from mainnet
//by address 0xC128a9954e6c874eA3d62ce62B468bA073093F25

// solium-disable linebreak-style
pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract BalMock is ERC20 {
struct Point{
    int128 bias;
    int128 slope; // - dweight / dt
    uint256 ts;
    uint256 blk; // block
}
// We cannot really do block numbers per se b/c slope is per time, not per block
// and per block could be fairly bad b/c Ethereum changes blocktimes.
// What we can do is to extrapolate ***At functions

struct LockedBalance{
    int128 amount; 
    uint256 end;
}  

// interface ERC20(){
//     function view decimals() returns ;
//     function view name() -> String[64]: view
//     function view symbol() -> String[32]: view
//     function nonpayable transfer(to: address, amount: uint256) -> bool: nonpayable
//     function nonpayable transferFrom(spender: address, to: address, amount: uint256) -> bool: nonpayable
// }

// Interface for checking whether address belongs to a whitelisted
// type of a smart wallet.
// When new types are added - the whole contract is changed
// The check() method is modifying to be able to use caching
// for individual wallet addresses
interface SmartWalletChecker(){
    function check(address addr) returns (bool);//-> bool: nonpayable
}
    

int128 constant DEPOSIT_FOR_TYPE = 0;
CREATE_LOCK_TYPE: constant(int128) = 1
INCREASE_LOCK_AMOUNT: constant(int128) = 2
INCREASE_UNLOCK_TIME: constant(int128) = 3

event Deposit(address provider, uint256 value, uint256 locktime, int128 type, uint256 ts);
event Withdraw(address provider, uint256 value, uint256 ts);
event Supply(uint256 prevSupply, uint256 supply);


WEEK: constant(uint256) = 7 * 86400  # all future times are rounded by week
MAXTIME: constant(uint256) = 365 * 86400  # 1 year
MULTIPLIER: constant(uint256) = 10 ** 18

TOKEN: immutable(address)
AUTHORIZER_ADAPTOR: immutable(address) # Authorizer Adaptor

string immutable NAME;
string immutable SYMBOL;
uint256 immutable DECIMALS;

uint256 public supply;

locked: public(HashMap[address, LockedBalance])

epoch: public(uint256)
point_history: public(Point[100000000000000000000000000000])  # epoch -> unsigned point
user_point_history: public(HashMap[address, Point[1000000000]])  # user -> Point[user_epoch]
user_point_epoch: public(HashMap[address, uint256])
slope_changes: public(HashMap[uint256, int128])  # time -> signed slope change

// Checker for whitelisted (smart contract) wallets which are allowed to deposit
// The goal is to prevent tokenizing the escrow
future_smart_wallet_checker: public(address)
smart_wallet_checker: public(address)


    //__init__
    constructor(
        address token_addr,
        string memory _name,
        string memory  _symbol,
        address _authorizer_adaptor
    ) ERC20(_name, _symbol)
    public {

    }
}


