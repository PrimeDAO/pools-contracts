//mock of vebal contract from mainnet
//by address 0xC128a9954e6c874eA3d62ce62B468bA073093F25

// solium-disable linebreak-style
pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
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

    enum ActionType {DEPOSIT_FOR_TYPE, CREATE_LOCK_TYPE, INCREASE_LOCK_AMOUNT, INCREASE_UNLOCK_TIME}

    event Deposit(address indexed provider, uint256 value, uint256 indexed locktime, uint actionType, uint256 ts);
    event Withdraw(address indexed provider, uint256 value, uint256 ts);
    event Supply(uint256 prevSupply, uint256 supply);

    uint256 constant WEEK = 7 weeks; //all future times are rounded by week
    uint256 constant MAXTIME = 365 days; // 1 year
    uint256 constant MULTIPLIER = 10 ** 18;


    address immutable TOKEN; 
    address immutable AUTHORIZER_ADAPTOR; //Authorizer Adaptor

    //string is not succorted to be immutable in solidity
    string public NAME; //immutable NAME;
    string public SYMBOL; //immutable SYMBOL; 
    uint256 immutable DECIMALS;

    uint256 public supply;
    uint256 private _totalSupply;

    mapping(address => LockedBalance) public locked;

    uint256 public epoch;
    Point[100000000000000000000000000000] public point_history; //epoch -> unsigned point
    mapping(address => Point[1000000000]) private user_point_history; //user -> Point[user_epoch]
    mapping(address => uint256) public user_point_epoch;
    mapping(uint256 => uint256) public slope_changes; //time -> signed slope change

    // Checker for whitelisted (smart contract) wallets which are allowed to deposit
    // The goal is to prevent tokenizing the escrow
    address public future_smart_wallet_checker;
    address public smart_wallet_checker;

    /**
    @notice Contract constructor
    @param token_addr 80/20 BAL-WETH BPT token address
    @param _name Token name
    @param _symbol Token symbol
    @param _authorizer_adaptor `AuthorizerAdaptor` contract address
    */
    //__init__
    constructor(
        address token_addr,
        string memory _name,
        string memory  _symbol,
        address _authorizer_adaptor
    ) ERC20(_name, _symbol)
    public {
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
    function name() public view virtual override returns (string memory){
        return NAME;
    }
    function symbol() public view virtual override returns (string memory){
        return SYMBOL;
    }
    function decimals_() public view virtual returns (uint256){
        return DECIMALS;
    }
    function admin() external view returns (address){
        return AUTHORIZER_ADAPTOR;
    }

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
            uint8 checkExeption = 0;
            address checker = smart_wallet_checker;
            if (checker != ZERO_ADDRESS) {
                // if (SmartWalletChecker(checker).check(addr)){ //TODO: uncomment and fix test part; fix check() function
                    checkExeption = 1;
                    return;
                // }
            }
            require(checkExeption == 1, "Smart contract depositors not allowed");
            // raise "Smart contract depositors not allowed";
        }
    } 

    /**
    @notice Get the most recently recorded rate of voting power decrease for `addr`
    @param addr Address of the user wallet
    @return Value of the slope
    */   
    function get_last_user_slope(address addr) external view returns (uint256){
        uint256 uepoch = user_point_epoch[addr];
        return user_point_history[addr][uepoch].slope;
    }

    /**
    @notice Get the timestamp for checkpoint `_idx` for `_addr`
    @param _addr User wallet address
    @param _idx User epoch number
    @return Epoch time of the checkpoint
    */
    function user_point_history__ts(address _addr, uint256 _idx) external view returns (uint256){
        return user_point_history[_addr][_idx].ts;
    }

    /**
    @notice Get timestamp when `_addr`'s lock finishes
    @param _addr User wallet
    @return Epoch time of the lock end
    */
    function locked__end(address _addr) external view returns (uint256){
        return locked[_addr].end;
    }

    uint256 user_epoch; //here because was eror that 'stack is too deep'
    function _checkpoint(address addr, LockedBalance memory old_locked, LockedBalance memory new_locked) internal {
        Point memory u_old; //empty(Point);
        Point memory u_new; //empty(Point);

        uint256 old_dslope = 0;
        uint256 new_dslope = 0;
        uint256 _epoch= epoch;

        if (addr != ZERO_ADDRESS) {
            // Calculate slopes and biases
            // Kept at zero when they have to
            if (old_locked.end > block.timestamp && old_locked.amount > 0) {
                u_old.slope = old_locked.amount / MAXTIME;                
                u_old.bias = u_old.slope * uint256(old_locked.end - block.timestamp);
            if (new_locked.end > block.timestamp && new_locked.amount > 0) {
                u_new.slope = new_locked.amount / MAXTIME;                
                u_new.bias = u_new.slope * uint256(new_locked.end - block.timestamp);
            }

            // Read values of scheduled changes in the slope
            // old_locked.end can be in the past and in the future
            // new_locked.end can ONLY by in the FUTURE unless everything expired: than zeros
            old_dslope = slope_changes[old_locked.end];
            if (new_locked.end != 0) {
                if (new_locked.end == old_locked.end) {
                    new_dslope = old_dslope;
                } else {
                    new_dslope = slope_changes[new_locked.end];
                }
            }
        }
        Point memory last_point = Point({bias: 0, slope: 0, ts: block.timestamp, blk: block.number});
        if (_epoch > 0) {
            last_point = point_history[_epoch];
        }
        uint256 last_checkpoint = last_point.ts;
        // initial_last_point is used for extrapolation to calculate block number
        // (approximately, for *At methods) and save them
        // as we cannot figure that out exactly from inside the contract
        Point memory initial_last_point = Point({bias : last_point.bias, slope : last_point.slope, ts : last_point.ts, blk : last_point.blk});//last_point;
        uint256 block_slope = 0;  // dblock/dt
        if (block.timestamp > last_point.ts) {
            block_slope = MULTIPLIER * (block.number - last_point.blk) / (block.timestamp - last_point.ts);
        }
        // If last point is already recorded in this block, slope=0
        // But that's ok b/c we know the block in such case

        // Go over weeks to fill history and calculate what the current point is
        uint256 t_i = (last_checkpoint / WEEK) * WEEK;
         for (uint i; i < 255; i++) {
            // Hopefully it won't happen that this won't get used in 5 years!
            // If it does, users will be able to withdraw but vote weight will be broken
            t_i += WEEK;
            uint256 d_slope = 0;
            if (t_i > block.timestamp) {
                t_i = block.timestamp;
            } else {
                d_slope = slope_changes[t_i];
            }
            last_point.bias -= last_point.slope * uint256(t_i - last_checkpoint);
            last_point.slope += d_slope;
            if (last_point.bias < 0) {  // This can happen
                last_point.bias = 0;
            }
            if (last_point.slope < 0) {  // This cannot happen - just in case
                last_point.slope = 0;
            }
            last_checkpoint = t_i;
            last_point.ts = t_i;
            last_point.blk = initial_last_point.blk + (block_slope * (t_i - initial_last_point.ts) / MULTIPLIER);
            _epoch += 1;
            if (t_i == block.timestamp) {
                last_point.blk = block.number;
                break;
            } else {
                point_history[_epoch] = last_point;
            }
        }
        epoch = _epoch;
        // Now point_history is filled until t=now

        if (addr != ZERO_ADDRESS) {
            // If last point was in this block, the slope change has been applied already
            // But in such case we have 0 slope(s)
            last_point.slope += (u_new.slope - u_old.slope);
            last_point.bias += (u_new.bias - u_old.bias);
            if (last_point.slope < 0) {
                last_point.slope = 0;
            }
            if (last_point.bias < 0) {
                last_point.bias = 0;
            }
        }
        // Record the changed point into history
        point_history[_epoch] = last_point;

        if (addr != ZERO_ADDRESS) {
            // Schedule the slope changes (slope is going down)
            // We subtract new_user_slope from [new_locked.end]
            // and add old_user_slope to [old_locked.end]
            if (old_locked.end > block.timestamp) {
                // old_dslope was <something> - u_old.slope, so we cancel that
                old_dslope += u_old.slope;               
                if (new_locked.end == old_locked.end) {                  
                    old_dslope -= u_new.slope;  // It was a new deposit, not extension
                }
                slope_changes[old_locked.end] = old_dslope;
            }
            if (new_locked.end > block.timestamp) {
                if (new_locked.end > old_locked.end) {
                    new_dslope -= u_new.slope;  // old slope disappeared at this point
                    slope_changes[new_locked.end] = new_dslope;
                }
                // else: we recorded it already in old_dslope
            }
            // Now handle user history
            user_epoch = user_point_epoch[addr] + 1; //initialized before function because 'stack is too deep'

            user_point_epoch[addr] = user_epoch;
            u_new.ts = block.timestamp;
            u_new.blk = block.number;
            user_point_history[addr][user_epoch] = u_new;
        }
    }
    
    }
    function _deposit_for(address _addr, uint256 _value, uint256 unlock_time, LockedBalance memory locked_balance, ActionType actionType) internal {
        LockedBalance memory _locked = locked_balance;
        uint256 supply_before = supply;

        supply = supply_before + _value;
        LockedBalance memory old_locked = LockedBalance({amount : _locked.amount, end : _locked.end});//_locked;
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
            IERC20(TOKEN).transferFrom(_addr, address(this), _value);
        }

        emit Deposit(_addr, _value, _locked.end, uint(actionType), block.timestamp);
        emit Supply(supply_before, supply_before + _value);
    }

    function checkpoint() external {
        LockedBalance memory empty = LockedBalance({amount: 0, end: 0}); //empty(LockedBalance);
        _checkpoint(ZERO_ADDRESS, empty, empty);//empty(LockedBalance), empty(LockedBalance));
    }

    function deposit_for(address _addr, uint256 _value) external nonReentrant {
        LockedBalance memory _locked = locked[_addr];

        require(_value > 0);  // dev: need non-zero value
        require(_locked.amount > 0, "No existing lock found");
        require(_locked.end > block.timestamp, "Cannot add to expired lock. Withdraw");

        _deposit_for(_addr, _value, 0, _locked, ActionType.DEPOSIT_FOR_TYPE);
    }

    function create_lock(uint256 _value, uint256 _unlock_time) external nonReentrant {
        assert_not_contract(msg.sender);
        uint256 unlock_time = (_unlock_time / WEEK) * WEEK; // Locktime is rounded down to weeks
        LockedBalance memory _locked = locked[msg.sender];

        require(_value > 0); // dev: need non-zero value
        require(_locked.amount == 0, "Withdraw old tokens first");
        require(unlock_time > block.timestamp, "Can only lock until time in the future");
        require(unlock_time <= block.timestamp + MAXTIME, "Voting lock can be 1 year max");

        _deposit_for(msg.sender, _value, unlock_time, _locked, ActionType.CREATE_LOCK_TYPE);
    }

    function increase_amount(uint256 _value) external nonReentrant {
        assert_not_contract(msg.sender);
        LockedBalance memory _locked = locked[msg.sender];

        require(_value > 0); // dev: need non-zero value
        require(_locked.amount > 0, "No existing lock found");
        require(_locked.end > block.timestamp, "Cannot add to expired lock. Withdraw");

        _deposit_for(msg.sender, _value, 0, _locked, ActionType.INCREASE_LOCK_AMOUNT);
    }
    function increase_unlock_time(uint256 _unlock_time) external nonReentrant {
        assert_not_contract(msg.sender);
        LockedBalance memory _locked = locked[msg.sender];
        uint256 unlock_time = (_unlock_time / WEEK) * WEEK; // Locktime is rounded down to weeks

        require(_locked.end > block.timestamp, "Lock expired");
        require(_locked.amount > 0, "Nothing is locked");
        require(unlock_time > _locked.end, "Can only increase lock duration");
        require(unlock_time <= block.timestamp + MAXTIME, "Voting lock can be 1 year max");

        _deposit_for(msg.sender, 0, unlock_time, _locked, ActionType.INCREASE_UNLOCK_TIME);
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

        require(IERC20(TOKEN).transfer(msg.sender, value));

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
        for (uint i; i < 128; i++) { // Will be always enough for 128-bit numbers
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
        for (uint i; i < 128; i++) { // Will be always enough for 128-bit numbers
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
        for (uint i; i < 128; i++) { // Will be always enough for 128-bit numbers
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
        for (uint i; i < 128; i++) {  // Will be always enough for 128-bit numbers
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

    function NbalanceOf(address addr, uint256 _t) external view returns (uint256){ // TypeError: setup.tokens.VeBal.balanceOf is not a function 
        if (_t == 0){
            _t = block.timestamp;
        }
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

    /**
    @notice Get the current voting power for `msg.sender`
    @dev Adheres to the ERC20 `balanceOf` interface for Aragon compatibility
    @param addr User wallet address
    @param _t Epoch time to return voting power at
    @return User voting power
    */
    function balanceOf(address addr, uint256 _t) external view returns (uint256){
        if (_t == 0){
            _t = block.timestamp;
        }
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
        for (uint i; i < 255; i++) {
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

