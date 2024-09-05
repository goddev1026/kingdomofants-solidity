// SPDX-License-Identifier: MIT OR Apache-2.0

/*
W: https://kingdomofants.io 

                ▒▒██            ██▒▒                
                    ██        ██                    
                    ██  ████  ██                    
                    ████▒▒▒▒████                    
████              ██▒▒▒▒▒▒▒▒▒▒▒▒██              ████
██▒▒██            ██▒▒██▒▒▒▒██▒▒██            ██▒▒██
██▒▒██            ██▒▒██▒▒▒▒██▒▒██            ██▒▒██
  ██              ██▒▒▒▒▒▒▒▒▒▒▒▒██              ██  
    ██            ██▒▒██▒▒▒▒██▒▒██            ██    
      ██          ▓▓▒▒▒▒████▒▒▒▒██          ██      
        ██          ████████████          ██        
          ██          ██▒▒▒▒██          ██          
            ██████████▒▒▒▒▒▒▒▒██████████            
                    ██▒▒▒▒▒▒▒▒██                    
          ████████████▒▒▒▒▒▒▒▒████████████          
        ██          ██▒▒▒▒▒▒▒▒██          ██        
      ██            ██▒▒▒▒▒▒▒▒██            ██      
    ██            ████▒▒▒▒▒▒▒▒████            ██    
  ██            ██    ████████    ██            ██  
██▒▒██        ██    ██▒▒▒▒▒▒▒▒██    ██        ██▒▒██
██▒▒██      ██      ██▒▒▒▒▒▒▒▒██      ██      ██▒▒██
████      ██        ██▒▒▒▒▒▒▒▒██        ██      ████
        ██          ██▒▒▒▒▒▒▒▒██          ██        
        ██          ██▒▒▒▒▒▒▒▒██          ██        
        ██          ██▒▒▒▒▒▒▒▒██          ██        
        ██          ██▒▒▒▒▒▒▒▒██          ██        
        ██            ██▒▒▒▒██            ██        
      ████            ██▒▒▒▒██            ████      
    ██▒▒██              ████              ██▒▒██    
    ██████                                ██████    

* Howdy folks! Thanks for glancing over our contracts
* Y'all have a nice day! Enjoy the game
*/

pragma solidity ^0.8.13;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './interfaces/IANTCoin.sol';
import 'hardhat/console.sol';

contract Vesting is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable, UUPSUpgradeable {

    using SafeMath for uint256;

    // Vesting Pool Struct

    struct VestingPool {
      string poolName; // vesting pool name
      uint256 initReleaseRate; // initial release percentage
      uint256 maxReleaseCount; // max vesting pool released count
      uint256 currentReleasedCount; // current vesting pool released count
      uint256 lastReleaseTime; // recent released timestamp
      uint256 tokenAmount; // deposited ant coin token amount
      uint256 initReleasedTokenAmount; // init distributed token amount
      bool isLaunched; // vesting pool is launched or not
    }

    // Reference to ANTCoin
    IANTCoin public antCoin;
    // array of vesting pools
    VestingPool[] public vestingPools;
    
    // minters
    mapping(address => bool) private minters;
    // mapping of user wallet addresses for receving the tokens from vesting pools
    mapping(uint256 => address[]) public userAddresses;
    // one time release timestamp
    
    uint256 public releaseCycle;
    
    // make sure vesting pool info and pool index is correct
    modifier isValidPool(uint256 _poolIndex) {
      require(vestingPools.length > 0, "Vesting: vesting pool info isn't exist");
      require(_poolIndex < vestingPools.length, "Vesting: invalid vesting pool index");
      _;
    }

    modifier onlyMinterOrOwner() {
        require(minters[_msgSender()] || _msgSender() == owner(), "Vesting: Caller is not the owner or minter");
        _;
    }

    // Event for adding vesting pool info
    event AddVestingPoolInfo(uint256 poolIndex, string poolName);
    // Event for revoking vesting pool info
    event RevokeVestingPoolInfo(uint256 poolIndex);
    // Event for launching the vesting pool
    event LaunchVestingPool(uint256 poolIndex, string poolName, uint256 initDistributionAmount);
    // Event for releasing the vesting pool
    event ReleaseVestingPool(uint256 poolIndex, string poolName, uint256 releasedAmount);

    constructor() {

    }

    function initialize(IANTCoin _antCoin) initializer public {
        __Pausable_init();
        __Ownable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        antCoin = _antCoin;

        releaseCycle = 30 days;
    }

    /**
    * ██ ███    ██ ████████
    * ██ ████   ██    ██
    * ██ ██ ██  ██    ██
    * ██ ██  ██ ██    ██
    * ██ ██   ████    ██
    * This section has internal only functions
    */

    /**
    * @notice Transfer ETH and return the success status.
    * @dev This function only forwards 30,000 gas to the callee.
    * @param to Address for ETH to be send to
    * @param value Amount of ETH to send
    */
    function _safeTransferETH(address to, uint256 value) internal returns (bool) {
        (bool success, ) = to.call{ value: value, gas: 30_000 }(new bytes(0));
        return success;
    }

    /**
    * ███████ ██   ██ ████████
    * ██       ██ ██     ██
    * █████     ███      ██
    * ██       ██ ██     ██
    * ███████ ██   ██    ██
    * This section has external functions
    */

    /**
    * @notice Check address has minterRole
    */

    function getMinterRole(address _address) public view returns(bool) {
        return minters[_address];
    }

    /**
    * @notice Return Vesting Pool Info by index
    * @param _poolIndex vesting pool index
    */

    function getVestingPoolInfo(uint256 _poolIndex) external view isValidPool(_poolIndex) returns(VestingPool memory) {
      return vestingPools[_poolIndex];
    }

    /**
    * @notice Return the filled user wallet addresses by pool index
    * @param _poolIndex vesting pool index
    */

    function getUserAddressesByPoolIndex(uint256 _poolIndex) external view isValidPool(_poolIndex) returns(address[] memory) {
      return userAddresses[_poolIndex];
    }

    /**
    *   ██████  ██     ██ ███    ██ ███████ ██████
    *  ██    ██ ██     ██ ████   ██ ██      ██   ██
    *  ██    ██ ██  █  ██ ██ ██  ██ █████   ██████
    *  ██    ██ ██ ███ ██ ██  ██ ██ ██      ██   ██
    *   ██████   ███ ███  ██   ████ ███████ ██   ██
    * This section will have all the internals set to onlyOwner
    */

    /**
    * @notice launch vesting pool and distribute the initial profit to users
    * @dev This function can only be called by the owner
    * @param _poolIndex vesting pool index
    */

    function launchVestingPool(uint256 _poolIndex) external onlyMinterOrOwner isValidPool(_poolIndex) {
      VestingPool memory _poolInfo = vestingPools[_poolIndex];
      require(!_poolInfo.isLaunched, "Vesting: already launched");
      require(userAddresses[_poolIndex].length > 0, "Vesting: empty array detected");
      
      uint256 initReleaseAmount = _poolInfo.tokenAmount * _poolInfo.initReleaseRate / 100;
      uint256 distributionAmount = initReleaseAmount / userAddresses[_poolIndex].length;

      for(uint256 i = 0; i < userAddresses[_poolIndex].length; i++) {
        antCoin.transfer(userAddresses[_poolIndex][i], distributionAmount);
      }

      vestingPools[_poolIndex].initReleasedTokenAmount = initReleaseAmount;
      vestingPools[_poolIndex].lastReleaseTime = block.timestamp;
      vestingPools[_poolIndex].isLaunched = true;

      emit LaunchVestingPool(_poolIndex, _poolInfo.poolName, initReleaseAmount);
    }

    /**
    * @notice release ant coins to users
    * @dev This function can only be called by the owner
    * @param _poolIndex vesting pool index
    */

    function releaseVestingPool(uint256 _poolIndex) external onlyMinterOrOwner isValidPool(_poolIndex) {
        VestingPool storage _poolInfo = vestingPools[_poolIndex];

        require(_poolInfo.currentReleasedCount < _poolInfo.maxReleaseCount, "Vesting: can't release any coins anymore from vesting pool");
        require(_poolInfo.isLaunched, "Vesting: the pool is not launched yet");

        uint256 _periodCount = (block.timestamp - _poolInfo.lastReleaseTime) / releaseCycle;

        require(_periodCount > 0, "Vesting: can't release any coins yet");

        uint256 _maxRemainingPeriods = _poolInfo.maxReleaseCount - _poolInfo.currentReleasedCount;
        uint256 _periodsWithinLimit = _periodCount > _maxRemainingPeriods ? _maxRemainingPeriods : _periodCount;

        _poolInfo.currentReleasedCount += _periodsWithinLimit;
        _poolInfo.lastReleaseTime = block.timestamp;

        uint256 _rewardAmount = (_poolInfo.tokenAmount - _poolInfo.initReleasedTokenAmount) * _periodsWithinLimit / _poolInfo.maxReleaseCount;
        uint256 _distributionAmount = _rewardAmount / userAddresses[_poolIndex].length;

        for(uint256 i = 0; i < userAddresses[_poolIndex].length; i++) {
            antCoin.transfer(userAddresses[_poolIndex][i], _distributionAmount);
        }

        emit ReleaseVestingPool(_poolIndex, _poolInfo.poolName, _rewardAmount);
    }

    /**
    * @notice deposit ant coin into vesting pool by index
    * @dev This function can only be called by the owner
    * @param _poolIndex vesting pool index
    * @param _tokenAmount ant coin token amount for depositing
    */

    function depositANTCoinToVestingPool(uint256 _poolIndex, uint256 _tokenAmount) external onlyMinterOrOwner isValidPool(_poolIndex) {
        require(antCoin.balanceOf(_msgSender()) >= _tokenAmount, "Vesting: insufficient ant coin balance for depositing tokens");
        require(!vestingPools[_poolIndex].isLaunched, "Vesting: can't deposit anymore after lauching the vesting pool");
        antCoin.transferFrom(_msgSender(), address(this), _tokenAmount);
        vestingPools[_poolIndex].tokenAmount += _tokenAmount;
    }

    /**
    * @notice withdraw ant coin into vesting pool by index
    * @dev This function can only be called by the owner
    * @param _poolIndex vesting pool index
    * @param _tokenAmount ant coin token amount for depositing
    */

    function withdrawANTCoinFromVestingPool(uint256 _poolIndex, uint256 _tokenAmount) external onlyMinterOrOwner isValidPool(_poolIndex) {
        require(vestingPools[_poolIndex].tokenAmount >= _tokenAmount, "Vesting: insufficient ant coin balance for withdrawing tokens");
        require(!vestingPools[_poolIndex].isLaunched, "Vesting: can't withdraw anymore after lauching the vesting pool");
        antCoin.transfer(_msgSender(), _tokenAmount);
        vestingPools[_poolIndex].tokenAmount -= _tokenAmount;
    }

    /**
    * @notice add vesting pool info into vesting pools array
    * @dev This function can only be called by the owner
    * @param _poolName vesting pool name
    * @param _initReleaseRate initial release percentage when launch, e.g. 10 = 10%
    * @param _releaseCount release month count
    */

    function addVestingPoolInfo(string memory _poolName, uint256 _initReleaseRate, uint256 _releaseCount) external onlyMinterOrOwner {
      vestingPools.push(VestingPool({
        poolName: _poolName,
        initReleaseRate: _initReleaseRate,
        maxReleaseCount: _releaseCount,
        currentReleasedCount: 0,
        lastReleaseTime: 0,
        tokenAmount: 0,
        isLaunched: false,
        initReleasedTokenAmount: 0
      }));

      emit AddVestingPoolInfo(vestingPools.length - 1, _poolName);
    }

    /**
    * @notice remove vesting pool info from vesting pools array
    * @dev This function can only be called by the owner
    * @param _poolIndex vesting pool index
    */

    function revokeVestingPoolInfo(uint256 _poolIndex) external onlyMinterOrOwner isValidPool(_poolIndex) {
      uint256 lastPoolIndex = vestingPools.length - 1;
      address[] storage poolAddresses = userAddresses[lastPoolIndex];

      VestingPool memory _vestingPool = vestingPools[lastPoolIndex];
      vestingPools[_poolIndex] = _vestingPool;
      vestingPools.pop();
      userAddresses[_poolIndex] = poolAddresses;

      delete userAddresses[lastPoolIndex];

      emit RevokeVestingPoolInfo(_poolIndex);
    }

    /**
    * @notice add user wallet addresses for individual vesting pool
    * @dev This function can only be called by the owner
    * @param _poolIndex vesting pool index
    * @param _userAddresses array of user wallet addresses
    */

    function addUserAddressesByPool(uint256 _poolIndex, address[] memory _userAddresses) external onlyMinterOrOwner isValidPool(_poolIndex) {
      require(_userAddresses.length > 0, "Vesting: array of user wallet addresses must be greater than zero");
      for(uint256 i = 0; i < _userAddresses.length; i++) {
        userAddresses[_poolIndex].push(_userAddresses[i]);
      }
    }

    /**
    * @notice remove user wallet addresses
    * @dev This function can only be called by the owner
    * @param _poolIndex vesting pool index
    */

    function revokeUserAddressesFromPool(uint256 _poolIndex) external onlyMinterOrOwner isValidPool(_poolIndex) {
      delete userAddresses[_poolIndex];
    }

    /**
    * @notice Set one time release cycle period
    * @dev This function can only be called by the owner
    * @param _releaseCycle release cycle period time stamp
    */

    function setReleaseCycle(uint256 _releaseCycle) external onlyMinterOrOwner {
      releaseCycle = _releaseCycle;
    }

    /**
    * @notice Set ANTCoin contract address
    * @dev This function can only be called by the owner
    * @param _antCoin ANTCoin contract address
    */

    function setANTCoinContract(IANTCoin _antCoin) external onlyMinterOrOwner {
        antCoin = _antCoin;
    }

    /**
    * @notice Function to grant mint role
    * @dev This function can only be called by the owner
    * @param _address address to get minter role
    */

    function addMinterRole(address _address) external onlyOwner {
        minters[_address] = true;
    }

    /**
    * @notice Function to revoke mint role
    * @dev This function can only be called by the owner
    * @param _address address to revoke minter role
    */

    function revokeMinterRole(address _address) external onlyOwner {
        minters[_address] = false;
    }

    /**
    * enables owner to pause / unpause contract
    */
    function setPaused(bool _paused) external onlyOwner {
        if (_paused) _pause();
        else _unpause();
    }

    /**
    * @notice Allows owner to withdraw ETH funds to an address
    * @dev wraps _user in payable to fix address -> address payable
    * @param to Address for ETH to be send to
    * @param amount Amount of ETH to send
    */
    function withdraw(address payable to, uint256 amount) public onlyOwner {
        require(_safeTransferETH(to, amount));
    }

    /**
    * @notice Allows ownder to withdraw any accident tokens transferred to contract
    * @param _tokenContract Address for the token
    * @param to Address for token to be send to
    * @param amount Amount of token to send
    */
    function withdrawToken(
        address _tokenContract,
        address to,
        uint256 amount
    ) public onlyOwner {
        IERC20 tokenContract = IERC20(_tokenContract);
        tokenContract.transfer(to, amount);
    }

    function _authorizeUpgrade(address newImplementation) internal onlyOwner override {}
}