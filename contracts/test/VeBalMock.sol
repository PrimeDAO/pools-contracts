//mock of vebal contract from mainnet
//by address 0xC128a9954e6c874eA3d62ce62B468bA073093F25

// solium-disable linebreak-style
pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface BAL_ERC20 { //was just ERC20 in their Vyper contract
    function decimals_() external view returns (uint256);
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function transfer(address to, uint256 amount) external returns (bool); //nonpayable
    function transferFrom(address spender, address to, uint256 amount) external returns (bool); //nonpayable
}
// Interface for checking whether address belongs to a whitelisted
// type of a smart wallet.
// When new types are added - the whole contract is changed
// The check() method is modifying to be able to use caching
// for individual wallet addresses 
interface SmartWalletChecker {
    function check(address addr) external returns (bool);//nonpayable
}   

contract VeBalMock is ERC20, ReentrancyGuard {

    struct Point{
        uint256 bias;
        uint256 slope; // - dweight / dt
        uint256 ts;
        uint256 blk; // block
    }
    // We cannot really do block numbers per se b/c slope is per time, not per block
    // and per block could be fairly bad b/c Ethereum changes blocktimes.
    // What we can do is to extrapolate ***At functions

    struct LockedBalance{
        uint256 amount; 
        uint256 end;
    }  

    address constant ZERO_ADDRESS = address(0x0000000000000000000000000000000000000000);

    uint256 constant DEPOSIT_FOR_TYPE = 0;
    uint256 constant CREATE_LOCK_TYPE = 1;
    uint256 constant INCREASE_LOCK_AMOUNT = 2;
    uint256 constant INCREASE_UNLOCK_TIME = 3;

    event Deposit(address indexed provider, uint256 value, uint256 indexed locktime, uint256 type_, uint256 ts); //if just type without _ --> was highlited as error
    event Withdraw(address indexed provider, uint256 value, uint256 ts);
    event Supply(uint256 prevSupply, uint256 supply);

    uint256 constant WEEK = 7 * 86400; //all future times are rounded by week
    uint256 constant MAXTIME = 365 * 86400;  // 1 year
    uint256 constant MULTIPLIER = 10 ** 18;


    address immutable TOKEN; 
    address immutable AUTHORIZER_ADAPTOR; //Authorizer Adaptor

    //string is not succorted to be immutable in solidity
    string public NAME; //immutable NAME;
    string public SYMBOL; //immutable SYMBOL; 
    uint256 immutable DECIMALS;

    uint256 public supply;
    // mapping(address => uint256) supply;
    uint256 private _totalSupply;

    mapping(address => LockedBalance) public locked;

    uint256 public epoch;

    Point[100000000000000000000000000000] public point_history; //epoch -> unsigned point
    mapping(address => Point[1000000000]) private user_point_history; //user -> Point[user_epoch]
    mapping(address => uint256) public user_point_epoch;
    mapping(uint256 => int128) public slope_changes; //time -> signed slope change

    // Checker for whitelisted (smart contract) wallets which are allowed to deposit
    // The goal is to prevent tokenizing the escrow
    address public future_smart_wallet_checker;
    address public smart_wallet_checker;


    //__init__
    constructor(
        address token_addr,
        string memory _name,
        string memory  _symbol,
        address _authorizer_adaptor
    ) ERC20(_name, _symbol)
    public {
        /**
        @notice Contract constructor
        @param token_addr 80/20 BAL-WETH BPT token address
        @param _name Token name
        @param _symbol Token symbol
        @param _authorizer_adaptor `AuthorizerAdaptor` contract address
        */
        require(_authorizer_adaptor != ZERO_ADDRESS, "BalMock: _authorizer_adaptor == ZERO_ADDRESS");

        TOKEN = token_addr;
        AUTHORIZER_ADAPTOR = _authorizer_adaptor;
        point_history[0].blk = block.number;
        point_history[0].ts = block.timestamp;

        uint256 _decimals = ERC20(token_addr).decimals();
        require(_decimals <= 255, "BalMock: _decimals > 255");

        NAME = _name;
        SYMBOL = _symbol;
        DECIMALS = _decimals;
    }

    function token() external view returns (address){
        return TOKEN;
    }
    function name() public view virtual returns (string memory){
        return NAME;
    }
    function symbol() public view virtual returns (string memory){
        return SYMBOL;
    }
    function decimals() public view virtual returns (uint256){
        return DECIMALS;
    }
    // function decimals_() public view virtual returns (uint256){
    //     return DECIMALS;
    // }
    function admin() external view returns (address){
        return AUTHORIZER_ADAPTOR;
    }

    function NbalanceOf(address addr) external view returns (uint256){
        /**
        @notice Get the current voting power for `msg.sender`
        @dev Adheres to the ERC20 `balanceOf` interface for Aragon compatibility
        @param addr User wallet address
        @param _t Epoch time to return voting power at
        @return User voting power
        */
        // if (t !=0 ) {
            uint256 _t = block.timestamp;
        // }
        uint256 _epoch = 0;
        if (_t == block.timestamp) {
            // No need to do binary search, will always live in current epoch
            _epoch = user_point_epoch[addr];
        } else {
            _epoch = find_timestamp_user_epoch(addr, _t, user_point_epoch[addr]);
        }
        
        if (_epoch == 0) {
            return 0;
        } else {
            Point memory last_point = user_point_history[addr][_epoch];
            last_point.bias -= last_point.slope * uint256(_t - last_point.ts);
            if (last_point.bias < 0) {
                last_point.bias = 0;
            }
            return uint256(last_point.bias);
        }

        // //some code and actual rerurn is not 1
        // return 1;
    }

    // function balanceOf(address addr, uint256 _t) external view returns (uint256){
    //     /**
    //     @notice Get the current voting power for `msg.sender`
    //     @dev Adheres to the ERC20 `balanceOf` interface for Aragon compatibility
    //     @param addr User wallet address
    //     @param _t Epoch time to return voting power at
    //     @return User voting power
    //     */
    //     uint256 _t = block.timestamp;

    //     //some code and actual rerurn is not 1
    //     return 1;
    // }

    function commit_smart_wallet_checker(address addr) external {
        require(msg.sender == AUTHORIZER_ADAPTOR);
        future_smart_wallet_checker = addr;
    }
    function apply_smart_wallet_checker() external {
        require(msg.sender == AUTHORIZER_ADAPTOR);
        smart_wallet_checker = future_smart_wallet_checker;
    }
    function assert_not_contract(address addr) internal {
        if (addr != tx.origin) {
            address checker = smart_wallet_checker;
            if (checker != ZERO_ADDRESS) {
                if (SmartWalletChecker(checker).check(addr)){
                    return;
                }
            }
            // raise "Smart contract depositors not allowed";
        }
    }    
    function get_last_user_slope(address addr) external view returns (uint256){
        /**
        @notice Get the most recently recorded rate of voting power decrease for `addr`
        @param addr Address of the user wallet
        @return Value of the slope
        */
        uint256 uepoch = user_point_epoch[addr];
        return user_point_history[addr][uepoch].slope;
    }
    function user_point_history__ts(address _addr, uint256 _idx) external view returns (uint256){
        /**
        @notice Get the timestamp for checkpoint `_idx` for `_addr`
        @param _addr User wallet address
        @param _idx User epoch number
        @return Epoch time of the checkpoint
    */
        return user_point_history[_addr][_idx].ts;
    }
    function locked__end(address _addr) external view returns (uint256){
        /**
        @notice Get timestamp when `_addr`'s lock finishes
        @param _addr User wallet
        @return Epoch time of the lock end
        */
        return locked[_addr].end;
    }

    function _checkpoint(address addr, LockedBalance memory old_locked, LockedBalance memory new_locked) internal {}
    
    function _deposit_for(address _addr, uint256 _value, uint256 unlock_time, LockedBalance memory locked_balance, int128 type_) internal {
        LockedBalance memory _locked = locked_balance;
        uint256 supply_before = supply;

        supply = supply_before + _value;
        LockedBalance memory old_locked = _locked;
        // Adding to existing lock, or if a lock is expired - creating a new one
        _locked.amount += uint256(_value);
        if (unlock_time != 0) {
            _locked.end = unlock_time;
        }
        locked[_addr] = _locked;

        // Possibilities:
        // Both old_locked.end could be current or expired (>/< block.timestamp)
        // value == 0 (extend lock) or value > 0 (add to lock or extend lock)
        // _locked.end > block.timestamp (always)
        _checkpoint(_addr, old_locked, _locked);

        if (_value != 0) {
            require(ERC20(TOKEN).transferFrom(_addr, address(this), _value));
        }
        emit Deposit(_addr, _value, _locked.end, type, block.timestamp);
        emit Supply(supply_before, supply_before + _value);
    }
    
    // function empty(){}
    // function checkpoint() external {
    //     _checkpoint(ZERO_ADDRESS, empty(LockedBalance), empty(LockedBalance));
    // }

    function deposit_for(address _addr, uint256 _value) external nonReentrant {
        LockedBalance memory _locked = locked[_addr];

        require(_value > 0);  // dev: need non-zero value
        require(_locked.amount > 0, "No existing lock found");
        require(_locked.end > block.timestamp, "Cannot add to expired lock. Withdraw");

        _deposit_for(_addr, _value, 0, locked[_addr], DEPOSIT_FOR_TYPE);
    }

    function create_lock(uint256 _value, uint256 _unlock_time) external nonReentrant {

        assert_not_contract(msg.sender);
        uint256 unlock_time = (_unlock_time / WEEK) * WEEK; // Locktime is rounded down to weeks
        LockedBalance memory _locked = locked[msg.sender];

        require(_value > 0); // dev: need non-zero value
        require(_locked.amount == 0, "Withdraw old tokens first");
        require(unlock_time > block.timestamp, "Can only lock until time in the future");
        require(unlock_time <= block.timestamp + MAXTIME, "Voting lock can be 1 year max");

        _deposit_for(msg.sender, _value, unlock_time, _locked, CREATE_LOCK_TYPE);
    }

    function increase_amount(uint256 _value) external nonReentrant {
        assert_not_contract(msg.sender);
        LockedBalance memory _locked = locked[msg.sender];

        require(_value > 0); // dev: need non-zero value
        require(_locked.amount > 0, "No existing lock found");
        require(_locked.end > block.timestamp, "Cannot add to expired lock. Withdraw");

        _deposit_for(msg.sender, _value, 0, _locked, INCREASE_LOCK_AMOUNT);
    }
    function increase_unlock_time(uint256 _unlock_time) external nonReentrant {
        assert_not_contract(msg.sender);
        LockedBalance memory _locked = locked[msg.sender];
        uint256 unlock_time = (_unlock_time / WEEK) * WEEK; // Locktime is rounded down to weeks

        require(_locked.end > block.timestamp, "Lock expired");
        require(_locked.amount > 0, "Nothing is locked");
        require(unlock_time > _locked.end, "Can only increase lock duration");
        require(unlock_time <= block.timestamp + MAXTIME, "Voting lock can be 1 year max");

        _deposit_for(msg.sender, 0, unlock_time, _locked, INCREASE_UNLOCK_TIME);
    }

    function withdraw() external nonReentrant {
        LockedBalance memory _locked = locked[msg.sender];
        require(block.timestamp >= _locked.end, "The lock didn't expire");
        uint256 value = uint256(_locked.amount);

        LockedBalance memory old_locked = _locked;
        _locked.end = 0;
        _locked.amount = 0;
        locked[msg.sender] = _locked;
        uint256 supply_before = supply;
        supply = supply_before - value;

        // old_locked can have either expired <= timestamp or zero end
        // _locked has only 0 end
        // Both can have >= 0 amount
        _checkpoint(msg.sender, old_locked, _locked);

        require(ERC20(TOKEN).transfer(msg.sender, value));

        emit Withdraw(msg.sender, value, block.timestamp);
        emit Supply(supply_before, supply_before - value);
    }

    // The following ERC20/minime-compatible methods are not real balanceOf and supply!
    // They measure the weights for the purpose of voting, so they don't represent
    // real coins.


        /**
        @notice Binary search to find epoch containing block number
        @param _block Block to find
        @param max_epoch Don't go beyond this epoch
        @return Epoch which contains _block
        */
    function find_block_epoch(uint256 _block, uint256 max_epoch) internal view returns (uint256){
        // Binary search
        uint256 _min = 0;
        uint256 _max = max_epoch;
        for (uint256 i = 0; i < 128; i++) { // Will be always enough for 128-bit numbers
            if (_min >= _max) {
                break;
            }
            uint256 _mid = (_min + _max + 1) / 2;
            if (point_history[_mid].blk <= _block) {
                _min = _mid;
            } else {
                _max = _mid - 1;
            }
        }
        return _min;        
    }

        /**
        @notice Binary search to find epoch for timestamp
        @param _timestamp timestamp to find
        @param max_epoch Don't go beyond this epoch
        @return Epoch which contains _timestamp
        */
    function find_timestamp_epoch(uint256 _timestamp, uint256 max_epoch) internal view returns (uint256){
        // Binary search
        uint256 _min = 0;
        uint256 _max = max_epoch;
        for (uint256 i = 0; i < 128; i++) { // Will be always enough for 128-bit numbers
            if (_min >= _max) {
                break;
            }
            uint256 _mid = (_min + _max + 1) / 2;
            if (point_history[_mid].ts <= _timestamp) {
                _min = _mid;
            } else {
                _max = _mid - 1;
            }
        }
        return _min;
    }

    /**
    @notice Binary search to find epoch for block number
    @param _addr User for which to find user epoch for
    @param _block Block to find
    @param max_epoch Don't go beyond this epoch
    @return Epoch which contains _block
    */
    function find_block_user_epoch(address _addr, uint256 _block, uint256 max_epoch) internal view returns (uint256){
        // Binary search
        uint256 _min = 0;
        uint256 _max = max_epoch;
        for (uint256 i = 0; i < 128; i++) { // Will be always enough for 128-bit numbers
            if (_min >= _max) {
                break;
            }
            uint256 _mid = (_min + _max + 1) / 2;
            if (user_point_history[_addr][_mid].blk <= _block) {
                _min = _mid;
            } else {
                _max = _mid - 1;
            }
        }
        return _min;
    }

    /**
    @notice Binary search to find user epoch for timestamp
    @param _addr User for which to find user epoch for
    @param _timestamp timestamp to find
    @param max_epoch Don't go beyond this epoch
    @return Epoch which contains _timestamp
    */
    function find_timestamp_user_epoch(address _addr, uint256 _timestamp, uint256 max_epoch) internal view returns (uint256){
        // Binary search
        uint256 _min = 0;
        uint256 _max = max_epoch;
        for (uint256 i = 0; i < 128; i++) {  // Will be always enough for 128-bit numbers
            if (_min >= _max) {
                break;
            }
            uint256 _mid = (_min + _max + 1) / 2;
            if (user_point_history[_addr][_mid].ts <= _timestamp) {
                _min = _mid;
            } else {
                _max = _mid - 1;
            }
        }
        return _min;
    }

    /**
    @notice Get the current voting power for `msg.sender`
    @dev Adheres to the ERC20 `balanceOf` interface for Aragon compatibility
    @param addr User wallet address
    @param _t Epoch time to return voting power at
    @return User voting power
    */
    function balanceOf(address addr, uint256 _t) external view returns (uint256){
        uint256 _t = block.timestamp;
        uint256 _epoch = 0;
        if (_t == block.timestamp) {
            // No need to do binary search, will always live in current epoch
            _epoch = user_point_epoch[addr];
        } else {
            _epoch = find_timestamp_user_epoch(addr, _t, user_point_epoch[addr]);
        }

        if (_epoch == 0) {
            return 0;
        } else {
            Point memory last_point = user_point_history[addr][_epoch];
            last_point.bias -= last_point.slope * uint256(_t - last_point.ts);
            if (last_point.bias < 0) {
                last_point.bias = 0;
            }
            return uint256(last_point.bias);
        }
    }

    function balanceOfAt(address addr, uint256 _block) external view returns (uint256){
        require(_block <= block.number);

        uint256 _user_epoch = find_block_user_epoch(addr, _block, user_point_epoch[addr]);
        Point memory upoint = user_point_history[addr][_user_epoch];

        uint256 max_epoch = epoch;
        uint256 _epoch= find_block_epoch(_block, max_epoch);
        Point memory point_0 = point_history[_epoch];
        uint256 d_block = 0;
        uint256 d_t = 0;
        if (_epoch < max_epoch) {
            Point memory point_1 = point_history[_epoch + 1];
            d_block = point_1.blk - point_0.blk;
            d_t = point_1.ts - point_0.ts;
        } else {
            d_block = block.number - point_0.blk;
            d_t = block.timestamp - point_0.ts;
        }
        uint256 block_time = point_0.ts;
        if (d_block != 0) {
            block_time += d_t * (_block - point_0.blk) / d_block;
        }
        upoint.bias -= upoint.slope * uint256(block_time - upoint.ts);
        if (upoint.bias >= 0) {
            return uint256(upoint.bias);
        } else {
            return 0;
        }
    }

    /**
    @notice Calculate total voting power at some point in the past
    @param point The point (bias/slope) to start search from
    @param t Time to calculate the total voting power at
    @return Total voting power at that time
    */
    function supply_at(Point memory point, uint256 t) internal view returns (uint256){
        Point memory last_point = point;
        uint256 t_i = (last_point.ts / WEEK) * WEEK;
        for (uint256 i = 0; i < 255; i++) {
            t_i += WEEK;
            uint256 d_slope = 0;
            if (t_i > t) {
                t_i = t;
            } else {
                d_slope = slope_changes[t_i];
            }
            last_point.bias -= last_point.slope * uint256(t_i - last_point.ts);
            if (t_i == t) {
                break;
            }
            last_point.slope += d_slope;
            last_point.ts = t_i;
        }
        if (last_point.bias < 0) {
            last_point.bias = 0;
        }
        return uint256(last_point.bias);    
    }

    /**
    @notice Calculate total voting power
    @dev Adheres to the ERC20 `totalSupply` interface for Aragon compatibility
    @return Total voting power
    */
    function totalSupply(uint256 t) external view returns (uint256){
        uint256 _epoch = 0;
        if (t == block.timestamp) {
            // No need to do binary search, will always live in current epoch
            _epoch = epoch;
        } else {
            _epoch = find_timestamp_epoch(t, epoch);
        }
        if (_epoch == 0) {
            return 0;
        } else {
            Point memory last_point = point_history[_epoch];
            return supply_at(last_point, t);
        }
    }

    /**
    @notice Calculate total voting power at some point in the past
    @param _block Block to calculate the total voting power at
    @return Total voting power at `_block`
    */
    function totalSupplyAt(uint256 _block) external view returns (uint256){
        require(_block <= block.number, "_block > block.number");
        uint256 _epoch = epoch;
        uint256 target_epoch = find_block_epoch(_block, _epoch);

        Point memory point = point_history[target_epoch];
        uint256 dt = 0;
        if (target_epoch < _epoch){
            Point memory point_next = point_history[target_epoch + 1];
            if (point.blk != point_next.blk){
                dt = (_block - point.blk) * (point_next.ts - point.ts) / (point_next.blk - point.blk);
            }
        }else{
            if (point.blk != block.number){
                dt = (_block - point.blk) * (block.timestamp - point.ts) / (block.number - point.blk);
            }
        }
        // Now dt contains info on how far are we beyond point

        return supply_at(point, point.ts + dt);
    }

}

