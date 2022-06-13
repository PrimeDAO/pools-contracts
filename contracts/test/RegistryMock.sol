// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

/// @title Mock Registry Address Provider
contract RegistryMock {
    event NewAddressIdentifier(uint256 indexed id, address addr, string description);
    event AddressModified(uint256 indexed id, address new_address, uint256 version);
    event CommitNewAdmin(uint256 indexed deadline, address indexed admin);
    event NewAdmin(address indexed admin);

    struct AddressInfo {
        address addr;
        bool is_active;
        uint256 version;
        uint256 last_modified;
        string description;
    }


    address private registry;
    address public admin;
    address public future_admin;
    address constant ZERO_ADDRESS = address(0x0000000000000000000000000000000000000000);

    uint256 public queue_length;
    uint256 public transfer_ownership_deadline;
    uint256 constant SECONDS_IN_THREE_DAYS = 3 * 86400;


    mapping(uint256 => AddressInfo) public get_id_info;

    constructor(address _admin){
        admin = _admin;
        queue_length = 1;
        get_id_info[0].description = "Main Registry";
    }

    /// @notice Get the address of the main registry contract
    /// @dev This is a gas-efficient way of calling `AddressProvider.get_address(0)`
    /// @return address main registry contract
    function get_registry() external view returns(address){
        return registry;
    }

    /// @notice Get the highest ID set within the address provider
    /// @return uint256 max ID
    function max_id() external view returns(uint256){
        return queue_length - 1;
    }

    /// @notice Fetch the address associated with `_id`
    /// @dev Returns ZERO_ADDRESS if `_id` has not been defined, or has been unset
    /// @param _id Identifier to fetch an address for
    /// @return Current address associated to `_id`
    function get_address(uint256 _id) external view returns(address){
        return get_id_info[_id].addr;
    }

    /// @notice Add a new identifier to the registry
    /// @dev ID is auto-incremented
    /// @param _address Initial address to assign to new identifier
    /// @param _description Human-readable description of the identifier
    /// @return uint256 identifier
    function add_new_id(address _address, string memory _description) external returns(uint256){
        require(msg.sender == admin, "!admin");
        require(msg.sender == tx.origin, "!contract");

        uint256 id = queue_length;
        get_id_info[id] = AddressInfo({
            addr: _address,
            is_active: true,
            version: 1,
            last_modified: block.timestamp,
            description: _description
        });
        queue_length = id + 1;

        emit NewAddressIdentifier(id, _address, _description);

        return id;
    }

    /// @notice Set a new address for an existing identifier
    /// @param _id Identifier to set the new address for
    /// @param _address Address to set
    /// @return bool success
    function set_address(uint256 _id, address _address) external returns(bool){
        require(msg.sender == admin, "!admin");
        require(msg.sender == tx.origin, "!contract");
        require(queue_length > _id, "id does not exist");

        uint256 version = get_id_info[_id].version + 1;

        get_id_info[_id].addr = _address;
        get_id_info[_id].is_active = true;
        get_id_info[_id].version = version;
        get_id_info[_id].last_modified = block.timestamp;

        if(_id == 0){
            registry = _address;
        }

        emit AddressModified(_id, _address, version);

        return true;

    }

    /// @notice Unset an existing identifier
    /// @dev An identifier cannot ever be removed, it can only have the address unset so that it returns ZERO_ADDRESS
    /// @param _id Identifier to unset
    /// @return bool success
    function unset_address(uint256 _id) external returns(bool){
        require(msg.sender == admin, "!admin");
        require(get_id_info[_id].is_active, "!active");

        get_id_info[_id].is_active = false;
        get_id_info[_id].addr = ZERO_ADDRESS;
        get_id_info[_id].last_modified = block.timestamp;

        if(_id == 0){
            registry = ZERO_ADDRESS;
        }

        emit AddressModified(_id, ZERO_ADDRESS, get_id_info[_id].version);

        return true;
    }

    /// @notice Initiate a transfer of contract ownership
    /// @dev Once initiated, the actual transfer may be performed three days later
    /// @param _new_admin Address of the new owner account
    /// @return bool success
    function commit_transfer_ownership(address _new_admin) external returns (bool){
        require(msg.sender == admin, "!admin");
        require(transfer_ownership_deadline == 0, "transfer already active");

        uint256 deadline = block.timestamp + SECONDS_IN_THREE_DAYS;
        transfer_ownership_deadline = deadline;
        future_admin = _new_admin;

        emit CommitNewAdmin(deadline, _new_admin);

        return true;
    }

    /// @notice Finalize a transfer of contract ownership
    /// @dev May only be called by the current owner, three days after a call to `commit_transfer_ownership`
    /// @return bool success
    function apply_tranfer_ownership() external returns (bool){
        require(msg.sender == admin, "!admin");
        require(transfer_ownership_deadline != 0, "transfer not active");
        require(block.timestamp >= transfer_ownership_deadline, "now < deadline");

        address new_admin = future_admin;
        admin = new_admin;
        transfer_ownership_deadline = 0;

        emit NewAdmin(new_admin);

        return true;
    }

    /// @notice Revert a transfer of contract ownership
    /// @dev May only be called by the current owner
    /// @return bool success
    function revert_transfer_ownership() external returns(bool){
        require(msg.sender == admin, "!admin");
        transfer_ownership_deadline = 0;

        return true;
    }
}