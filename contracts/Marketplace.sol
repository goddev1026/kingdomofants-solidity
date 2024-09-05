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
import './interfaces/IANTShop.sol';
import './interfaces/IPurse.sol';
import './interfaces/IANTLottery.sol';

contract Marketplace is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable, UUPSUpgradeable {

    // info for minting each antshop items
    struct MintInfo {
        bool mintMethod;
        bool isSet;
        uint256 mintPrice;
        uint256 tokenAmountForMint;
        address tokenAddressForMint;
    }
    // reference to the ANTShop
    IANTShop public ANTShop;
    // reference to the Purse
    IPurse public Purse;
    // reference to the ANTLottery
    IANTLottery public ANTLottery;

    // purse token mint method true => matic mint, false => custom token mint like usdt
    bool public purseMintMethod;
    // matic price for purse minting
    uint256 public purseMintPrice;
    // token address for purse minting
    address public purseMintTokenAddress;
    // token amount for purse minting
    uint256 public purseMintTokenAmount;
    // lotteryTicket mint method true => matic mint, false => custom token mint like usdt
    bool public lotteryTicketMintMethod;
    // matic price for lotteryTicket minting
    uint256 public lotteryTicketMintPrice;
    // token address for lotteryTicket minting
    address public lotteryTicketMintTokenAddress;
    // token amount for lotteryTicket minting
    uint256 public lotteryTicketMintTokenAmount;
    // max number for buying the lottery tickets
    uint256 public maxNumberTicketsPerBuy;

    mapping(address => bool) private minters;
    // ANTShop tokens mint information
    mapping(uint256 => MintInfo) public mintInfo;

    modifier onlyMinterOrOwner() {
        require(minters[_msgSender()] || _msgSender() == owner(), "Marketplace: Caller is not the owner or minter");
        _;
    }
    
    // buy ANTShop tokens event
    event BuyANTShopToken(uint256 typeId, address recipient, uint256 quantity);
    // buy Purse tokens event
    event BuyPurseToken(address recipient, uint256 quantity);
    // buy Lottery Tickets event
    event BuyLotteryTickets(address recipient, uint256 quantity);
    
    constructor() {
    }

    function initialize(IANTShop _antShop, IPurse _purse, IANTLottery _antLottery) initializer public {
        __Pausable_init();
        __Ownable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        ANTShop = _antShop;
        Purse = _purse;
        ANTLottery = _antLottery;
        minters[_msgSender()] =  true;
        
        maxNumberTicketsPerBuy = 9999;
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
    * @notice           Sell ANTShop Tokens
    * @param _typeId    type id for mint info 0 => ANTFood, 1 => Leveling Potion
    * @param _quantity  ANTShop mint tokens number
    * @param _recipient buy token recipient wallet address
    */

    function buyTokens(uint256 _typeId, uint256 _quantity, address _recipient) external payable whenNotPaused nonReentrant {
        IANTShop.TypeInfo memory typeInfo = ANTShop.getInfoForType(_typeId);
        MintInfo memory _mintInfo = mintInfo[_typeId];
        require(typeInfo.isSet, "Marketplace: type info not set in ANTShop");
        require(_mintInfo.isSet, "Marketplace: mint info not set");
        if(_mintInfo.mintMethod){
            require(msg.value >= _mintInfo.mintPrice * _quantity, "Marketplace: Insufficient Matic");
        }
        else {
            require(_mintInfo.tokenAddressForMint != address(0x0), "Marketplace: token address can't be null");
            require(IERC20(_mintInfo.tokenAddressForMint).balanceOf(_msgSender()) >= _mintInfo.tokenAmountForMint * _quantity, "Marketplace: Insufficient Tokens");
            require(IERC20(_mintInfo.tokenAddressForMint).allowance(_msgSender(), address(this)) >= _mintInfo.tokenAmountForMint * _quantity, "Marketplace: You should approve tokens for minting");
            IERC20(_mintInfo.tokenAddressForMint).transferFrom(_msgSender(), address(this), _mintInfo.tokenAmountForMint * _quantity);
        }
        ANTShop.mint(_typeId, _quantity, _recipient);
        emit BuyANTShopToken(_typeId, _recipient, _quantity);
    }

    /**
    * @notice               Sell Purse Tokens
    * @param _recipient     buy token recipient wallet address
    * @param _quantity      mint tokens number to see purse tokens
    */

    function buyPurseTokens(address _recipient, uint256 _quantity) external payable whenNotPaused nonReentrant {
        if(purseMintMethod){
            require(msg.value >= purseMintPrice * _quantity, "Marketplace: Insufficient Matic");
        }
        else {
            require(purseMintTokenAddress != address(0x0), "Marketplace: token address can't be null");
            require(IERC20(purseMintTokenAddress).balanceOf(_msgSender()) >= purseMintTokenAmount * _quantity, "Marketplace: Insufficient Tokens");
            require(IERC20(purseMintTokenAddress).allowance(_msgSender(), address(this)) >= purseMintTokenAmount * _quantity, "Marketplace: You should approve tokens for minting");
            IERC20(purseMintTokenAddress).transferFrom(_msgSender(), address(this), purseMintTokenAmount * _quantity);
        }
        Purse.mint(_recipient, _quantity);
        emit BuyPurseToken(_recipient, _quantity);
    }

    /**
    * @notice               Sell Lottery Tickets
    * @param _recipient     buy tickets recipient wallet address
    * @param _quantity      mint tokens number to see lottery tickets
    */

    function buyLotteryTickets(address _recipient, uint256 _quantity) external payable whenNotPaused nonReentrant {
        if(lotteryTicketMintMethod){
            require(msg.value >= lotteryTicketMintPrice * _quantity, "Marketplace: Insufficient Matic");
        }
        else {
            require(lotteryTicketMintTokenAddress != address(0x0), "Marketplace: token address can't be null");
            require(IERC20(lotteryTicketMintTokenAddress).balanceOf(_msgSender()) >= lotteryTicketMintTokenAmount * _quantity, "Marketplace: Insufficient Tokens");
            require(IERC20(lotteryTicketMintTokenAddress).allowance(_msgSender(), address(this)) >= lotteryTicketMintTokenAmount * _quantity, "Marketplace: You should approve tokens for minting");
            IERC20(lotteryTicketMintTokenAddress).transferFrom(_msgSender(), address(this), lotteryTicketMintTokenAmount * _quantity);
        }
        ANTLottery.buyTickets(_recipient, _quantity);
        emit BuyLotteryTickets(_recipient, _quantity);
    }

    /**
    * @notice           Return Mint information(mint price, token address and amount for mint)
    * @param _typeId    type id for mint info 0 => ANTFood, 1 => Leveling Potion
    */

    function getMintInfo(uint256 _typeId) external view returns(MintInfo memory) {
        require(mintInfo[_typeId].isSet, "Marketplace: Mint information not set yet");
        return mintInfo[_typeId];
    }

    /**
    * @notice Check address has minterRole
    */

    function getMinterRole(address _address) public view returns(bool) {
        return minters[_address];
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
    * @notice                       Set mint information like mint price, token address and amount for minting
    * @dev                          This function can only be called by the owner
    * @param _typeId                type id for mint info 0 => ANTFood, 1 => Leveling Potion
    * @param _mintPrice             matic for minting
    * @param _tokenAddressForMint   token addres for minting
    * @param _tokenAmountForMint    token amount for minting
    */

    function setMintInfo(uint256 _typeId, uint256 _mintPrice, address _tokenAddressForMint, uint256 _tokenAmountForMint) external onlyMinterOrOwner {
        require(_tokenAddressForMint != address(0x0), "Marketplace: token address can't be a null address");
        mintInfo[_typeId].mintPrice = _mintPrice;
        mintInfo[_typeId].tokenAddressForMint = _tokenAddressForMint;
        mintInfo[_typeId].tokenAmountForMint = _tokenAmountForMint;
        mintInfo[_typeId].isSet = true;
        mintInfo[_typeId].mintMethod = true;
    }

    /**
    * @notice               Set mint method true => Matic mint, false => custom token mint
    * @dev                  This function can only be called by the owner
    * @param _typeId        type id for mint info 0 => ANTFood, 1 => Leveling Potion
    * @param _mintMethod    mint method value
    */

    function setMintMethod(uint256 _typeId, bool _mintMethod) external onlyMinterOrOwner {
        mintInfo[_typeId].mintMethod = _mintMethod;
    }

    /**
    * @notice               Set Purse token mint info
    * @dev                  This function can only be called by the owner
    * @param _mintMethod    mint method value true => matic mint, false => custom token mint like usdt
    * @param _maticPrice    matic mint price
    * @param _tokenAddress  token address for minting
    * @param _tokenAmount   token amount for minting
    */

    function setPurseMintInfo(bool _mintMethod, uint256 _maticPrice, address _tokenAddress, uint256 _tokenAmount) external onlyMinterOrOwner {
        require(_tokenAddress != address(0), "Marketplace: Purse token address can't be zero address");
        purseMintMethod = _mintMethod;
        purseMintPrice = _maticPrice;
        purseMintTokenAddress = _tokenAddress;
        purseMintTokenAmount = _tokenAmount;
    }

    /**
    * @notice               Set Lottery Ticket mint info
    * @dev                  This function can only be called by the owner
    * @param _mintMethod    mint method value true => matic mint, false => custom token mint like usdt
    * @param _maticPrice    matic mint price
    * @param _tokenAddress  token address for minting
    * @param _tokenAmount   token amount for minting
    */

    function setLotteryTicketMintInfo(bool _mintMethod, uint256 _maticPrice, address _tokenAddress, uint256 _tokenAmount) external onlyMinterOrOwner {
        require(_tokenAddress != address(0), "Marketplace: Lottery token address can't be zero address");
        lotteryTicketMintMethod = _mintMethod;
        lotteryTicketMintPrice = _maticPrice;
        lotteryTicketMintTokenAddress = _tokenAddress;
        lotteryTicketMintTokenAmount = _tokenAmount;
    }

    /**
    * @notice                           Set a new max number tickets per buy
    * @dev                              This function can only be called by the owner
    * @param _maxNumberTicketsPerBuy    max ticket numbers for buy
    */

    function setMaxNumberTicketsPerBuy(uint256 _maxNumberTicketsPerBuy) external onlyMinterOrOwner {
        maxNumberTicketsPerBuy = _maxNumberTicketsPerBuy;
    }

    /**
    * @notice       Set a new Purse smart contract address
    * @dev          This function can only be called by the owner
    * @param _purse Reference to Purse
    */

    function setPurseContract(IPurse _purse) external onlyMinterOrOwner {
        require(address(_purse) != address(0x0), "Marketplace: Purse address can't be null address");
        Purse = _purse;
    }

    /**
    * @notice           Set a new ANTShop smart contract address
    * @dev              This function can only be called by the owner
    * @param _antShop   Reference to ANTShop
    */

    function setANTShopContract(IANTShop _antShop) external onlyMinterOrOwner {
        require(address(_antShop) != address(0x0), "Marketplace: ANTShop address can't be null address");
        ANTShop = _antShop;
    }

    /**
    * @notice               Set a new ANTLottery smart contract address
    * @dev                  This function can only be called by the owner
    * @param _antLottery    Reference to ANTLottery
    */

    function setANTLotteryContract(IANTLottery _antLottery) external onlyMinterOrOwner {
        require(address(_antLottery) != address(0x0), "Marketplace: ANTLottery address can't be null address");
        ANTLottery = _antLottery;
    }

    /**
    * enables owner to pause / unpause contract
    */
    function setPaused(bool _paused) external onlyOwner {
        if (_paused) _pause();
        else _unpause();
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
    * @notice           Allows owner to withdraw ETH funds to an address
    * @dev              wraps _user in payable to fix address -> address payable
    * @param to         Address for ETH to be send to
    * @param amount     Amount of ETH to send
    */
    function withdraw(address payable to, uint256 amount) public onlyOwner {
        require(_safeTransferETH(to, amount));
    }

    /**
    * @notice                   Allows ownder to withdraw any accident tokens transferred to contract
    * @param _tokenContract     Address for the token
    * @param to                 Address for token to be send to
    * @param amount             Amount of token to send
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