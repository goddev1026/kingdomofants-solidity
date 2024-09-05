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
import './interfaces/IPremiumANT.sol';
import './interfaces/IBasicANT.sol';
import './interfaces/IANTCoin.sol';

contract Workforce is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable, UUPSUpgradeable {

    using SafeMath for uint256;

    // stake information for ANT
    struct StakeANT {
        uint256 tokenId; // ant token id
        address owner; // owner of staked ant
        uint256 batchIndex; // batch index of ants
        uint256 antCStakeAmount; // ant coin amount
        uint256 originTimestamp; // staked timestamp
    }

    // Reference to ANTCoin
    IANTCoin public antCoin;
    // Reference to Basic ANT
    IBasicANT public basicANT;
    // Reference to PremiumANT
    IPremiumANT public premiumANT;

    // minters
    mapping(address => bool) private minters;
    // Workforce for Basic ANT
    mapping(uint256 => StakeANT) public basicANTWorkforce;
    // Workforce for Premium ANT
    mapping(uint256 => StakeANT) public premiumANTWorkforce;
    // staked token id array for Basic ANT
    mapping(address => uint256[]) public basicANTStakedNFTs;
    // staked token id array for Premium ANT
    mapping(address => uint256[]) public premiumANTStakedNFTs;
    // array indices of each token id for Basic ANT
    mapping(uint256 => uint256) public basicANTStakedNFTsIndicies;
    // array indices of each token id for Premium ANT
    mapping(uint256 => uint256) public premiumANTStakedNFTsIndicies;
    
    // maximum stake period
    uint256 public maxStakePeriod;
    // a cycle for reward
    uint256 public cycleStakePeriod;
    // total number of staked Basic ANTs
    uint256 public totalBasicANTStaked;
    // total number of staked Premium ANTs
    uint256 public totalPremiumANTStaked;
    // initialize level after unstaking ant
    uint256 public initLevelAfterUnstake;
    // antcoin stake limit amount for each ants
    uint256 public limitAntCoinStakeAmount;

    // Events
    // basic ant stake event
    event WorkforceStakeBasicANT(uint256 id, address owner);
    // basic ant unstake event
    event WorkforceUnStakeBasicANT(uint256 id, address owner);
    // premium ant stake event
    event WorkforceStakePremiumANT(uint256 id, address owner);
    // premium ant unstake event
    event WorkforceUnStakePremiumANT(uint256 id, address owner);

    modifier onlyMinterOrOwner() {
        require(minters[_msgSender()] || _msgSender() == owner(), "Workforce: Caller is not the owner or minter");
        _;
    }

    constructor() {
    }

    function initialize(IANTCoin _antCoin, IPremiumANT _premiumANT, IBasicANT _basicANT) initializer public {
        __Pausable_init();
        __Ownable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        antCoin = _antCoin;
        premiumANT = _premiumANT;
        basicANT = _basicANT;

        maxStakePeriod = 3 * 365 days; // 3 years
        cycleStakePeriod = 1 * 365 days; // 1 year
        initLevelAfterUnstake = 1;
        limitAntCoinStakeAmount = 60000 ether;
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
    * @notice Return Premium ANT Stake information
    */

    function getPremiumANTStakeInfo(uint256 _tokenId) external view returns(StakeANT memory) {
        return premiumANTWorkforce[_tokenId];
    }

    /**
    * @notice Return Premium ANT Array Stake information
    */

    function getPremiumANTMultiStakeInfo(uint256[] calldata _tokenIds) external view returns(StakeANT[] memory) {
        uint256 tokenIdsLength = _tokenIds.length;
        if (tokenIdsLength == 0) {
            return new StakeANT[](0);
        }

        StakeANT[] memory _stakedInfos = new StakeANT[](tokenIdsLength);
        for(uint256 i = 0; i < tokenIdsLength; i++) {
            _stakedInfos[i] = premiumANTWorkforce[_tokenIds[i]];
        }
        return _stakedInfos;
    }

    /**
    * @notice Return Basic ANT Stake information
    */

    function getBasicANTStakeInfo(uint256 _tokenId) external view returns(StakeANT memory) {
        return basicANTWorkforce[_tokenId];
    }


    /**
    * @notice Return Basic ANT Array Stake information
    */

    function getBasicANTMultiStakeInfo(uint256[] calldata _tokenIds) external view returns(StakeANT[] memory) {
        uint256 tokenIdsLength = _tokenIds.length;
        if (tokenIdsLength == 0) {
            return new StakeANT[](0);
        }

        StakeANT[] memory _stakedInfos = new StakeANT[](tokenIdsLength);
        for(uint256 i = 0; i < tokenIdsLength; i++) {
            _stakedInfos[i] = basicANTWorkforce[_tokenIds[i]];
        }
        return _stakedInfos;
    }


    /**
    * @notice Return Staked Premium ANTs token ids
    * @param _owner user address to get the staked premium ant token ids
    */

    function getPremiumANTStakedByAddress(address _owner) public view returns(uint256[] memory) {
        return premiumANTStakedNFTs[_owner];
    }

    /**
    * @notice Return Staked Basic ANTs token ids
    * @param _owner user address to get the staked basic ant token ids
    */

    function getBasicANTStakedByAddress(address _owner) public view returns(uint256[] memory) {
        return basicANTStakedNFTs[_owner];
    }

    /**
    * @notice Return the current pending reward amount of Basic Token
    */

    function pendingRewardOfBasicToken(uint256 _tokenId) public view returns(uint256 pendingAmount) {
        StakeANT memory _stakeANTInfo = basicANTWorkforce[_tokenId];
        uint256 antExperience = basicANT.getANTExperience(_tokenId); // 3000 => 30.00%
        uint256 stakePeriod = block.timestamp.sub(_stakeANTInfo.originTimestamp);
        if(stakePeriod > maxStakePeriod) {
            pendingAmount = _stakeANTInfo.antCStakeAmount.mul(antExperience).mul(maxStakePeriod).div(cycleStakePeriod.mul(10 ** 4));
        }
        else {
            pendingAmount = _stakeANTInfo.antCStakeAmount.mul(antExperience).mul(stakePeriod).div(cycleStakePeriod.mul(10 ** 4));
        }
    }

    /**
    * @notice Return the current pending reward amount of Basic Tokens
    */

    function pendingRewardOfMultiBasicTokens(uint256[] calldata _tokenIds) public view returns(uint256[] memory) {
        uint256 tokenIdsLength = _tokenIds.length;
        if (tokenIdsLength == 0) {
            return new uint256[](0);
        }

        uint256[] memory _pendingAmounts = new uint256[](tokenIdsLength);

        for(uint256 i = 0; i < tokenIdsLength; i++) {
            StakeANT memory _stakeANTInfo = basicANTWorkforce[_tokenIds[i]];
            uint256 antExperience = basicANT.getANTExperience(_tokenIds[i]); // 3000 => 30.00%
            uint256 stakePeriod = block.timestamp.sub(_stakeANTInfo.originTimestamp);
            if(stakePeriod > maxStakePeriod) {
                _pendingAmounts[i] = _stakeANTInfo.antCStakeAmount.mul(antExperience).mul(maxStakePeriod).div(cycleStakePeriod.mul(10 ** 4));
            }
            else {
                _pendingAmounts[i] = _stakeANTInfo.antCStakeAmount.mul(antExperience).mul(stakePeriod).div(cycleStakePeriod.mul(10 ** 4));
            }
        }

        return _pendingAmounts;
    }

    /**
    * @notice Return the current pending amount of Premium Token
    */

    function pendingRewardOfPremiumToken(uint256 _tokenId) public view returns(uint256 pendingAmount) {
        StakeANT memory _stakeANTInfo = premiumANTWorkforce[_tokenId];
        uint256 antExperience = premiumANT.getANTExperience(_tokenId); // 3000 => 30.00%
        uint256 stakePeriod = block.timestamp.sub(_stakeANTInfo.originTimestamp);
        if(stakePeriod > maxStakePeriod) {
            pendingAmount = _stakeANTInfo.antCStakeAmount.mul(antExperience).mul(maxStakePeriod).div(cycleStakePeriod).div(10 ** 4);
        }
        else {
            pendingAmount = _stakeANTInfo.antCStakeAmount.mul(antExperience).mul(stakePeriod).div(cycleStakePeriod).div(10 ** 4);
        }
    }

    /**
    * @notice Return the current pending amount array of Premium Tokens
    */

    function pendingRewardOfMultiPremiumTokens(uint256[] calldata _tokenIds) public view returns(uint256[] memory) {
        uint256 tokenIdsLength = _tokenIds.length;
        if (tokenIdsLength == 0) {
            return new uint256[](0);
        }

        uint256[] memory _pendingAmounts = new uint256[](tokenIdsLength);
        for(uint256 i = 0; i < tokenIdsLength; i++) {
            StakeANT memory _stakeANTInfo = premiumANTWorkforce[_tokenIds[i]];
            uint256 antExperience = premiumANT.getANTExperience(_tokenIds[i]); // 3000 => 30.00%
            uint256 stakePeriod = block.timestamp.sub(_stakeANTInfo.originTimestamp);
            if(stakePeriod > maxStakePeriod) {
                _pendingAmounts[i] = _stakeANTInfo.antCStakeAmount.mul(antExperience).mul(maxStakePeriod).div(cycleStakePeriod).div(10 ** 4);
            }
            else {
                _pendingAmounts[i] = _stakeANTInfo.antCStakeAmount.mul(antExperience).mul(stakePeriod).div(cycleStakePeriod).div(10 ** 4);
            }
        }
        return _pendingAmounts;
    }

    /**
    * @notice Stake PremiumANT into Workforce with ANTCoin
    * @param _tokenId premium ant token id for stake
    * @param _antCAmount ant coin stake amount
    */

    function stakePremiumANT(uint256 _tokenId, uint256 _antCAmount) external whenNotPaused nonReentrant {
        require(premiumANT.ownerOf(_tokenId) == _msgSender(), 'Workforce: you are not owner of this token');
        require(_antCAmount > 0, "Workforce: ant coin stake amount should be > 0");
        require(_antCAmount <= limitAntCoinStakeAmount, "Workforce: ant coin stake amount exceed the limit amount");
        require(antCoin.balanceOf(_msgSender()) >= _antCAmount, 'Workforce: insufficient ant coin balance');
        IPremiumANT.ANTInfo memory _premiumANTInfo = premiumANT.getANTInfo(_tokenId);
        premiumANTWorkforce[_tokenId] = StakeANT({
            tokenId: _tokenId,
            owner: _msgSender(),
            antCStakeAmount: _antCAmount,
            batchIndex: _premiumANTInfo.batchIndex,
            originTimestamp: block.timestamp
        });
        premiumANTStakedNFTs[_msgSender()].push(_tokenId);
        premiumANTStakedNFTsIndicies[_tokenId] = premiumANTStakedNFTs[_msgSender()].length - 1;
        totalPremiumANTStaked += 1;
        premiumANT.transferFrom(_msgSender(), address(this), _tokenId);
        antCoin.transferFrom(_msgSender(), address(this), _antCAmount);
        emit WorkforceStakePremiumANT(_tokenId, _msgSender());
    }

    /**
    * @notice Stake BasicANT into Workforce with ANTCoin
    * @param _tokenId basic ant token id for stake
    * @param _antCAmount ant coin stake amount
    */

    function stakeBasicANT(uint256 _tokenId, uint256 _antCAmount) external whenNotPaused nonReentrant {
        require(basicANT.ownerOf(_tokenId) == _msgSender(), 'Workforce: you are not owner of this token');
        require(_antCAmount > 0, "Workforce: ant coin stake amount should be > 0");
        require(_antCAmount <= limitAntCoinStakeAmount, "Workforce: ant coin stake amount exceed the limit amount");
        require(antCoin.balanceOf(_msgSender()) >= _antCAmount, 'Workforce: insufficient ant coin balance');
        IBasicANT.ANTInfo memory _basicANTInfo = basicANT.getANTInfo(_tokenId);
        basicANTWorkforce[_tokenId] = StakeANT({
            tokenId: _tokenId,
            owner: _msgSender(),
            antCStakeAmount: _antCAmount,
            batchIndex: _basicANTInfo.batchIndex,
            originTimestamp: block.timestamp
        });
        basicANTStakedNFTs[_msgSender()].push(_tokenId);
        basicANTStakedNFTsIndicies[_tokenId] = basicANTStakedNFTs[_msgSender()].length - 1;
        totalBasicANTStaked += 1;
        basicANT.transferFrom(_msgSender(), address(this), _tokenId);
        antCoin.transferFrom(_msgSender(), address(this), _antCAmount);
        emit WorkforceStakeBasicANT(_tokenId, _msgSender());
    }

    /**
    * @notice UnStake Premium ANT from Workforce with reward
    * @param _tokenId Premium ant token id for unstake
    */

    function unStakePremiumANT(uint256 _tokenId) external whenNotPaused nonReentrant {
        StakeANT memory _stakeANTInfo = premiumANTWorkforce[_tokenId];
        require(_stakeANTInfo.owner == _msgSender(), 'Workforce: you are not owner of this premium ant');
        uint256 rewardAmount = pendingRewardOfPremiumToken(_tokenId);
        premiumANT.setLevel(_tokenId, initLevelAfterUnstake);
        premiumANT.transferFrom(address(this), _msgSender(), _tokenId);
        antCoin.transfer(_msgSender(), _stakeANTInfo.antCStakeAmount);
        antCoin.mint(_msgSender(), rewardAmount);
        uint256 lastStakedNFTs = premiumANTStakedNFTs[_msgSender()][premiumANTStakedNFTs[_msgSender()].length - 1];
        premiumANTStakedNFTs[_msgSender()][premiumANTStakedNFTsIndicies[_tokenId]] = lastStakedNFTs;
        premiumANTStakedNFTsIndicies[premiumANTStakedNFTs[_msgSender()][premiumANTStakedNFTs[_msgSender()].length - 1]] = premiumANTStakedNFTsIndicies[_tokenId];
        premiumANTStakedNFTs[_msgSender()].pop();
        totalPremiumANTStaked -= 1;
        delete premiumANTStakedNFTsIndicies[_tokenId];
        delete premiumANTWorkforce[_tokenId];
        emit WorkforceUnStakePremiumANT(_tokenId, _msgSender());
    }

    /**
    * @notice UnStake Basic ANT from Workforce with reward
    * @param _tokenId Basic ant token id for unstake
    */

    function unStakeBasicANT(uint256 _tokenId) external whenNotPaused nonReentrant {
        StakeANT memory _stakeANTInfo = basicANTWorkforce[_tokenId];
        require(_stakeANTInfo.owner == _msgSender(), 'Workforce: you are not owner of this basic ant');
        uint256 rewardAmount = pendingRewardOfBasicToken(_tokenId);
        basicANT.setLevel(_tokenId, initLevelAfterUnstake);
        basicANT.transferFrom(address(this), _msgSender(), _tokenId);
        antCoin.transfer(_msgSender(), _stakeANTInfo.antCStakeAmount);
        antCoin.mint(_msgSender(), rewardAmount);
        uint256 lastStakedNFTs = basicANTStakedNFTs[_msgSender()][basicANTStakedNFTs[_msgSender()].length - 1];
        basicANTStakedNFTs[_msgSender()][basicANTStakedNFTsIndicies[_tokenId]] = lastStakedNFTs;
        basicANTStakedNFTsIndicies[basicANTStakedNFTs[_msgSender()][basicANTStakedNFTs[_msgSender()].length - 1]] = basicANTStakedNFTsIndicies[_tokenId];
        basicANTStakedNFTs[_msgSender()].pop();
        totalBasicANTStaked -= 1;
        delete basicANTStakedNFTsIndicies[_tokenId];
        delete basicANTWorkforce[_tokenId];
        emit WorkforceUnStakeBasicANT(_tokenId, _msgSender());
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
    * @notice Set ANTCoin contract address
    * @dev This function can only be called by the owner
    * @param _antCoin ANTCoin contract address
    */

    function setANTCoinContract(IANTCoin _antCoin) external onlyMinterOrOwner {
        antCoin = _antCoin;
    }

    /**
    * @notice Set premium ant contract address
    * @dev This function can only be called by the owner
    * @param _premiumANT Premium ANT contract address
    */

    function setPremiumANTContract(IPremiumANT _premiumANT) external onlyMinterOrOwner {
        premiumANT = _premiumANT;
    }

    /**
    * @notice Set basic ant contract address
    * @dev This function can only be called by the owner
    * @param _basicANT Basic ANT contract address
    */

    function setBasicANTContract(IBasicANT _basicANT) external onlyMinterOrOwner {
        basicANT = _basicANT;
    }

    /**
    * @notice Set max stake period by timestamp
    * @dev This function can only be called by the owner
    * @param _maxStakePeriod max stake period timestamp
    */

    function setMaxStakePeriod(uint256 _maxStakePeriod) external onlyMinterOrOwner {
        maxStakePeriod = _maxStakePeriod;
    }

    /**
    * @notice Set cycle stake period by timestamp
    * @dev This function can only be called by the owner
    * @param _cycleStakePeriod one reward cycle period timestamp
    */

    function setCycleStakePeriod(uint256 _cycleStakePeriod) external onlyMinterOrOwner {
        cycleStakePeriod = _cycleStakePeriod;
    }

    /**
    * @notice Set init level after unstake ant
    * @dev This function can only be called by the owner
    * @param _level init level value
    */

    function setInitLevelAfterUnstake(uint256 _level) external onlyMinterOrOwner {
        initLevelAfterUnstake = _level;
    }

    /**
    * @notice Set ant coin stake limit amount for each ants
    * @dev This function can only be called by the owner
    * @param _limitStakeAmount limit antcoin stake amount
    */

    function setLimitAntCoinStakeAmount(uint256 _limitStakeAmount) external onlyMinterOrOwner {
        limitAntCoinStakeAmount = _limitStakeAmount;
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