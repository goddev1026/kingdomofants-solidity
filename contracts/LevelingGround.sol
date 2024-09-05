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
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './interfaces/IBasicANT.sol';
import './interfaces/IPremiumANT.sol';
import './interfaces/IANTCoin.sol';

contract LevelingGround is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable, UUPSUpgradeable {

    // stake information for ANT
    struct StakeANT {
        uint256 tokenId; // ant token id
        address owner; // owner of staked ant
        uint256 batchIndex; // batch index of ants
        uint256 originTimestamp; // staked timestamp
        uint256 level; // level of staked token
    }

    // Reference to Premium ANT contract
    IPremiumANT public premiumANT;
    // Reference to Basic ANT contract
    IBasicANT public basicANT;
    // Reference to ANT Shop contract
    IANTCoin public antCoin;
    // minters
    mapping(address => bool) private minters;
    // Ground for Basic ANT
    mapping(uint256 => StakeANT) public basicANTGround;
    // Ground for Premium ANT
    mapping(uint256 => StakeANT) public premiumANTGround;
    // staked token id array for Basic ANT
    mapping(address => uint256[]) public basicANTStakedNFTs;
    // staked token id array for Premium ANT
    mapping(address => uint256[]) public premiumANTStakedNFTs;
    // array indices of each token id for Basic ANT
    mapping(uint256 => uint256) public basicANTStakedNFTsIndicies;
    // array indices of each token id for Premium ANT
    mapping(uint256 => uint256) public premiumANTStakedNFTsIndicies;
    
    uint256 public PRECISION;
    // total number of staked Basic ANTs
    uint256 public totalBasicANTStaked;
    // total number of staked Premium ANTs
    uint256 public totalPremiumANTStaked;
    // ant coin stake fee amount
    uint256 public stakeFeeAmount;

    uint256 public fullCyclePeriod;

    uint256 public benefitCyclePeriod;
    // basic was ant batch index
    uint256 public basicWiseANTBatchIndex;
    // premium was ant batch index
    uint256 public premiumWiseANTBatchIndex;
    // basic wise ant reward speed times default 2x
    uint256 public basicWiseANTRewardSpeed;
    // premium wise ant reward speed times default 2x
    uint256 public premiumWiseANTRewardSpeed;

    // Events
    // basic ant stake event
    event LevelingGroundStakeBasicANT(uint256 id, address owner);
    // basic ant unstake event
    event LevelingGroundUnStakeBasicANT(uint256 id, address owner);
    // premium ant stake event
    event LevelingGroundStakePremiumANT(uint256 id, address owner);
    // premium ant unstake event
    event LevelingGroundUnStakePremiumANT(uint256 id, address owner);

    modifier onlyMinterOrOwner() {
        require(minters[_msgSender()] || _msgSender() == owner(), "LevelingGround: Caller is not the owner or minter");
        _;
    }
    
    constructor () {
    }

     function initialize(IANTCoin _antCoin, IPremiumANT _premiumANT, IBasicANT _basicANT) initializer public {
        __Pausable_init();
        __Ownable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        premiumANT = _premiumANT;
        basicANT = _basicANT;
        antCoin = _antCoin;
        minters[_msgSender()] = true;

        PRECISION = 1000;
        stakeFeeAmount = 100 ether;
        fullCyclePeriod = 48 hours;
        benefitCyclePeriod = 0.5 hours;
        basicWiseANTBatchIndex = 1;
        premiumWiseANTBatchIndex = 1;
        basicWiseANTRewardSpeed = 2;
        premiumWiseANTRewardSpeed = 2;
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
    * @notice       Transfer ETH and return the success status.
    * @dev          This function only forwards 30,000 gas to the callee.
    * @param to     Address for ETH to be send to
    * @param value  Amount of ETH to send
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
        return premiumANTGround[_tokenId];
    }

    /**
    * @notice Return Premium ANT Array Stake information
    */

    function getPremiumANTMultiStakeInfo(uint256[] calldata tokenIds) external view returns(StakeANT[] memory) {
        uint256 tokenIdsLength = tokenIds.length;
        if (tokenIdsLength == 0) {
            return new StakeANT[](0);
        }

        StakeANT[] memory _tokenInfos = new StakeANT[](tokenIdsLength);

        for(uint256 i = 0; i < tokenIdsLength; i++) {
            _tokenInfos[i] = premiumANTGround[tokenIds[i]];
        }

        return _tokenInfos;
    }

    /**
    * @notice Return Basic ANT Stake information
    */

    function getBasicANTStakeInfo(uint256 _tokenId) external view returns(StakeANT memory) {
        return basicANTGround[_tokenId];
    }

    /**
    * @notice Return Basic ANT Array Stake information
    */

    function getBasicANTMultiStakeInfo(uint256[] calldata tokenIds) external view returns(StakeANT[] memory) {
        uint256 tokenIdsLength = tokenIds.length;
        if (tokenIdsLength == 0) {
            return new StakeANT[](0);
        }

        StakeANT[] memory _tokenInfos = new StakeANT[](tokenIdsLength);

        for(uint256 i = 0; i < tokenIdsLength; i++) {
            _tokenInfos[i] = basicANTGround[tokenIds[i]];
        }

        return _tokenInfos;
    }


    /**
    * @notice           Return Staked Premium ANTs token ids
    * @param _owner     user address to get the staked premium ant token ids
    */

    function getPremiumANTStakedByAddress(address _owner) public view returns(uint256[] memory) {
        return premiumANTStakedNFTs[_owner];
    }

    /**
    * @notice       Return Staked Basic ANTs token ids
    * @param _owner user address to get the staked basic ant token ids
    */

    function getBasicANTStakedByAddress(address _owner) public view returns(uint256[] memory) {
        return basicANTStakedNFTs[_owner];
    }

    /**
    * @notice           Return penidng potions reward amount 1,000 = 1 potion
    * @param tokenId    premium ant token id for getting reward
    */

    function pendingRewardOfPremiumToken(uint256 tokenId) public view returns(uint256) {
        StakeANT storage _stakeANTInfo = premiumANTGround[tokenId];
        uint256 stakedPeriod = block.timestamp - _stakeANTInfo.originTimestamp;
        uint256 cyclePeriod = fullCyclePeriod - benefitCyclePeriod * (_stakeANTInfo.level - 1);

        if (_stakeANTInfo.batchIndex == premiumWiseANTBatchIndex) {
            return (stakedPeriod * premiumWiseANTRewardSpeed * PRECISION) / cyclePeriod; // 2x faster if ant is wise
        } else {
            return (stakedPeriod * PRECISION) / cyclePeriod;
        }
    }

    /**
    * @notice           Return penidng potions reward amount arrray. 1,000 = 1 potion
    * @param tokenIds   premium ant token ids for getting the earning amount
    */

    function pendingRewardOfMultiPremiumTokens(uint256[] calldata tokenIds) public view returns(uint256[] memory) {
        uint256 tokenIdsLength = tokenIds.length;
        if (tokenIdsLength == 0) {
            return new uint256[](0);
        }

        uint256[] memory _tokenInfos = new uint256[](tokenIdsLength);

        for(uint256 i = 0; i < tokenIdsLength; i++) {
            StakeANT storage _stakeANTInfo = premiumANTGround[tokenIds[i]];
            uint256 stakedPeriod = block.timestamp - _stakeANTInfo.originTimestamp;
            uint256 cyclePeriod = fullCyclePeriod - benefitCyclePeriod * (_stakeANTInfo.level - 1);

            if (_stakeANTInfo.batchIndex == premiumWiseANTBatchIndex) {
                _tokenInfos[i] = (stakedPeriod * premiumWiseANTRewardSpeed * PRECISION) / cyclePeriod; // 2x faster if ant is wise
            } else {
                _tokenInfos[i] = (stakedPeriod * PRECISION) / cyclePeriod;
            }
        }

        return _tokenInfos;
    }

    /**
    * @notice           Return penidng potions reward amount 1,000 = 1 potion
    * @param tokenId    basic ant token id for getting reward
    */

    function pendingRewardOfBasicToken(uint256 tokenId) public view returns(uint256) {
        StakeANT storage _stakeANTInfo = basicANTGround[tokenId];
        uint256 stakedPeriod = block.timestamp - _stakeANTInfo.originTimestamp;
        uint256 cyclePeriod = fullCyclePeriod - benefitCyclePeriod * (_stakeANTInfo.level - 1);

        if (_stakeANTInfo.batchIndex == basicWiseANTBatchIndex) {
            return (stakedPeriod * basicWiseANTRewardSpeed * PRECISION) / cyclePeriod; // 2x faster if ant is wise
        } else {
            return (stakedPeriod * PRECISION) / cyclePeriod;
        }
    }

    /**
    * @notice            Return penidng potions reward amount arrray. 1,000 = 1 potion
    * @param tokenIds    basic ant token ids for getting the earning amount
    */

    function pendingRewardOfMultiBasicTokens(uint256[] calldata tokenIds) public view returns(uint256[] memory) {
        uint256 tokenIdsLength = tokenIds.length;
        if (tokenIdsLength == 0) {
            return new uint256[](0);
        }

        uint256[] memory _tokenInfos = new uint256[](tokenIdsLength);

        for(uint256 i = 0; i < tokenIdsLength; i++) {
            StakeANT storage _stakeANTInfo = basicANTGround[tokenIds[i]];
            uint256 stakedPeriod = block.timestamp - _stakeANTInfo.originTimestamp;
            uint256 cyclePeriod = fullCyclePeriod - benefitCyclePeriod * (_stakeANTInfo.level - 1);

            if (_stakeANTInfo.batchIndex == basicWiseANTBatchIndex) {
                _tokenInfos[i] = (stakedPeriod * basicWiseANTRewardSpeed * PRECISION) / cyclePeriod; // 2x faster if ant is wise
            } else {
                _tokenInfos[i] = (stakedPeriod * PRECISION) / cyclePeriod;
            }
        }

        return _tokenInfos;
    }

    /**
    * @notice           Function to stake premium ant to Leveling ground with stake fee
    * @param tokenId    premium ant token id for staking
    */

    function stakePremiumANT(uint256 tokenId) external whenNotPaused nonReentrant {
        IPremiumANT.ANTInfo memory _premiumANTInfo = premiumANT.getANTInfo(tokenId);
        require(premiumANT.ownerOf(tokenId) == _msgSender(), "LevelingGround: you are not owner of this premium token");
        require(antCoin.balanceOf(_msgSender()) >= stakeFeeAmount, "LevelingGround: you don't have enough ant coin balance for stake fee");
        require(_premiumANTInfo.level < premiumANT.getMaxLevel(), "LevelingGround: your ant can't upgrade any more");
        premiumANTGround[tokenId] = StakeANT({ 
          tokenId: tokenId, 
          owner: _msgSender(), 
          originTimestamp: block.timestamp, 
          batchIndex: _premiumANTInfo.batchIndex,
          level: _premiumANTInfo.level
        });
        premiumANTStakedNFTs[_msgSender()].push(tokenId);
        premiumANTStakedNFTsIndicies[tokenId] = premiumANTStakedNFTs[_msgSender()].length - 1;
        totalPremiumANTStaked += 1;
        premiumANT.transferFrom(_msgSender(), address(this), tokenId);
        antCoin.burn(_msgSender(), stakeFeeAmount);
        emit LevelingGroundStakePremiumANT(tokenId, _msgSender());
    }

    /**
    * @notice           Function to stake basic ant to Leveling ground with stake fee
    * @param tokenId    basic ant token id for staking
    */

    function stakeBasicANT(uint256 tokenId) external whenNotPaused nonReentrant {
        IBasicANT.ANTInfo memory _basicANTInfo = basicANT.getANTInfo(tokenId);
        require(basicANT.ownerOf(tokenId) == _msgSender(), "LevelingGround: you are not owner of this basic token");
        require(antCoin.balanceOf(_msgSender()) >= stakeFeeAmount, "LevelingGround: you don't have enough ant coin balance for stake fee");
        require(_basicANTInfo.level < basicANT.getMaxLevel(), "LevelingGround: your ant can't upgrade any more");
        basicANTGround[tokenId] = StakeANT({ 
          tokenId: tokenId, 
          owner: _msgSender(), 
          originTimestamp: block.timestamp, 
          batchIndex: _basicANTInfo.batchIndex,
          level: _basicANTInfo.level
        });
        basicANTStakedNFTs[_msgSender()].push(tokenId);
        basicANTStakedNFTsIndicies[tokenId] = basicANTStakedNFTs[_msgSender()].length - 1;
        totalBasicANTStaked += 1;
        basicANT.transferFrom(_msgSender(), address(this), tokenId);
        antCoin.burn(_msgSender(), stakeFeeAmount);
        emit LevelingGroundStakeBasicANT(tokenId, _msgSender());
    }

    /**
    * @notice           Function to unStake premium ant from Leveling Ground
    * @param tokenId    premium ant token id for unStaking
    */

    function unStakePremiumANT(uint256 tokenId) external whenNotPaused nonReentrant {
        StakeANT memory _stakeANTInfo = premiumANTGround[tokenId];
        require(_stakeANTInfo.owner == _msgSender(), 'LevelingGround: you are not owner of this premium ant');
        uint256 rewardPotions = pendingRewardOfPremiumToken(tokenId);
        premiumANT.ownerANTUpgrade(tokenId, rewardPotions / PRECISION);
        premiumANT.transferFrom(address(this), _stakeANTInfo.owner, tokenId);
        uint256 lastStakedNFTs = premiumANTStakedNFTs[_msgSender()][premiumANTStakedNFTs[_msgSender()].length - 1];
        premiumANTStakedNFTs[_msgSender()][premiumANTStakedNFTsIndicies[tokenId]] = lastStakedNFTs;
        premiumANTStakedNFTsIndicies[premiumANTStakedNFTs[_msgSender()][premiumANTStakedNFTs[_msgSender()].length - 1]] = premiumANTStakedNFTsIndicies[tokenId];
        premiumANTStakedNFTs[_msgSender()].pop();
        totalPremiumANTStaked -= 1;
        delete premiumANTStakedNFTsIndicies[tokenId];
        delete premiumANTGround[tokenId];
        emit LevelingGroundUnStakePremiumANT(tokenId, _msgSender());
    }

    /**
    * @notice           Function to unStake basic ant from Leveling Ground
    * @param tokenId    basic ant token id for unStaking
    */

    function unStakeBasicANT(uint256 tokenId) external whenNotPaused nonReentrant {
        StakeANT memory _stakeANTInfo = basicANTGround[tokenId];
        require(_stakeANTInfo.owner == _msgSender(), 'LevelingGround: you are not owner of this basic ant');
        uint256 rewardPotions = pendingRewardOfBasicToken(tokenId);
        basicANT.ownerANTUpgrade(tokenId, rewardPotions / PRECISION);
        basicANT.transferFrom(address(this), _stakeANTInfo.owner, tokenId);
        uint256 lastStakedNFTs = basicANTStakedNFTs[_msgSender()][basicANTStakedNFTs[_msgSender()].length - 1];
        basicANTStakedNFTs[_msgSender()][basicANTStakedNFTsIndicies[tokenId]] = lastStakedNFTs;
        basicANTStakedNFTsIndicies[basicANTStakedNFTs[_msgSender()][basicANTStakedNFTs[_msgSender()].length - 1]] = basicANTStakedNFTsIndicies[tokenId];
        basicANTStakedNFTs[_msgSender()].pop();
        totalBasicANTStaked -= 1;
        delete basicANTStakedNFTsIndicies[tokenId];
        delete basicANTGround[tokenId];
        emit LevelingGroundUnStakeBasicANT(tokenId, _msgSender());
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
    * @notice                           Set premium wise ant reward faster speed e.g. 2 = 2x
    * @dev                              This function can only be called by the owner
    * @param _premiumWiseANTRewardSpeed reward speed times
    */

    function setPremiumWiseANTRewardSpeed(uint256 _premiumWiseANTRewardSpeed) external onlyMinterOrOwner {
        premiumWiseANTRewardSpeed = _premiumWiseANTRewardSpeed;
    }

    /**
    * @notice                           Set basic wise ant reward faster speed e.g. 2 = 2x
    * @dev                              This function can only be called by the owner
    * @param _basicWiseANTRewardSpeed   reward speed times
    */

    function setBasicWiseANTRewardSpeed(uint256 _basicWiseANTRewardSpeed) external onlyMinterOrOwner {
        basicWiseANTRewardSpeed = _basicWiseANTRewardSpeed;
    }

    /**
    * @notice           Set premium wise ant batch index
    * @dev              This function can only be called by the owner
    * @param _index     batch index for wise ant
    */

    function setPremiumWiseANTBatchIndex(uint256 _index) external onlyMinterOrOwner {
        premiumWiseANTBatchIndex = _index;
    }

    /**
    * @notice       Set basic wise ant batch index
    * @dev          This function can only be called by the owner
    * @param _index batch index for wise ant
    */

    function setBasicWiseANTBatchIndex(uint256 _index) external onlyMinterOrOwner {
        basicWiseANTBatchIndex = _index;
    }

    /**
    * @notice                   Set stake fee amount
    * @dev                      This function can only be called by the owner
    * @param _stakeFeeAmount    ant coin stake fee amount for staking
    */

    function setStakeFeeAmount(uint256 _stakeFeeAmount) external onlyMinterOrOwner {
        stakeFeeAmount = _stakeFeeAmount;
    }

    /**
    * @notice               Set Full Cycle Period for giving a Leveling Potion to token owner
    * @dev                  This function can only be called by the owner
    * @param _cyclePeriod   cycle period time
    */

    function setFullCyclePeriod(uint256 _cyclePeriod) external onlyMinterOrOwner {
        fullCyclePeriod = _cyclePeriod;
    }

    /**
    * @notice                       Set Benefit Cycle Period for giving a Leveling Potion to token owner
    * @dev                          This function can only be called by the owner
    * @param _benefitCyclePeriod    benefit period time
    */

    function setBenefitCyclePeriod(uint256 _benefitCyclePeriod) external onlyMinterOrOwner {
        benefitCyclePeriod = _benefitCyclePeriod;
    }

    /**
    * @notice           Set ANTCoin contract address
    * @dev              This function can only be called by the owner
    * @param _antCoin   ANTCoin contract address
    */

    function setANTCoinContract(IANTCoin _antCoin) external onlyMinterOrOwner {
        antCoin = _antCoin;
    }

    /**
    * @notice               Set premium ant contract address
    * @dev                  This function can only be called by the owner
    * @param _premiumANT    Premium ANT contract address
    */

    function setPremiumANTContract(IPremiumANT _premiumANT) external onlyMinterOrOwner {
        premiumANT = _premiumANT;
    }

    /**
    * @notice           Set basic ant contract address
    * @dev              This function can only be called by the owner
    * @param _basicANT  Basic ANT contract address
    */

    function setBasicANTContract(IBasicANT _basicANT) external onlyMinterOrOwner {
        basicANT = _basicANT;
    }

    /**
    * @notice           Function to grant mint role
    * @dev              This function can only be called by the owner
    * @param _address   address to get minter role
    */
    function addMinterRole(address _address) external onlyOwner {
        minters[_address] = true;
    }

    /**
    * @notice           Function to revoke mint role
    * @dev              This function can only be called by the owner
    * @param _address   address to revoke minter role
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
    * @notice       Allows owner to withdraw ETH funds to an address
    * @dev          wraps _user in payable to fix address -> address payable
    * @param to     Address for ETH to be send to
    * @param amount Amount of ETH to send
    */
    function withdraw(address payable to, uint256 amount) public onlyOwner {
        require(_safeTransferETH(to, amount));
    }

    /**
    * @notice               Allows ownder to withdraw any accident tokens transferred to contract
    * @param _tokenContract Address for the token
    * @param to             Address for token to be send to
    * @param amount         Amount of token to send
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