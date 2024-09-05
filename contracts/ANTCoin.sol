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

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
// import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./interfaces/IANTCoin.sol";

contract ANTCoin is Initializable, ERC20Upgradeable, PausableUpgradeable, OwnableUpgradeable, UUPSUpgradeable, IANTCoin {

    // Max Circulation Supply Amount
    uint256 public maxCirculationSupply; // 200 million

    address public burnWallet1;
    address public burnWallet2;

    // minters
    mapping(address => bool) private minters;

    modifier onlyMinterOrOwner() {
        require(minters[_msgSender()] || _msgSender() == owner(), "ANTCoin: Caller is not the owner or minter");
        _;
    }

    constructor() {
    }

    function initialize(uint256 _maxCirculationSupply, address _burnWallet1, address _burnWallet2) initializer public {
        __ERC20_init("ANT Coin", "ANTC");
        __Pausable_init();
        __Ownable_init();
        __UUPSUpgradeable_init();

        maxCirculationSupply = _maxCirculationSupply;
        burnWallet1 = _burnWallet1;
        burnWallet2 = _burnWallet2;

        minters[_msgSender()] = true;
        _mint(_msgSender(), 100000000 ether); // 100 million
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
     * @dev See {IERC20-balanceOf}.
     */
    function balanceOf(address account) public view override(ERC20Upgradeable, IANTCoin) returns (uint256) {
        return super.balanceOf(account);
    }

    /**
    * @notice Check address has minterRole
    */

    function getMinterRole(address _address) public view returns(bool) {
        return minters[_address];
    }

    /**
    * @notice           Mint ANT Coin tokens to receipt address
    * @dev              Modifer to require msg.sender to be minter
    * @param receipt    Receipt address to mint the tokens
    * @param _amount    The amount to mint the tokens
    */

    function mint(address receipt, uint256 _amount) public override onlyMinterOrOwner {
        require(totalCirculatingSupply() + _amount <= maxCirculationSupply, "ANTCoin: Mint amount exceed Max Circulation Supply");
        _mint(receipt, _amount);
    }

    /**
    * @notice Override `transferFrom` function of ERC20 token
    */

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public virtual override(ERC20Upgradeable, IANTCoin) whenNotPaused returns (bool) {
        if(minters[_msgSender()]) {
            _approve(from, to, amount);
        }
        return super.transferFrom(from, to, amount);
    }

    /**
    * @notice Override `transfer` function of ERC20 token
    */

    function transfer(address to, uint256 amount) public virtual override(ERC20Upgradeable, IANTCoin) whenNotPaused returns (bool) {
        return super.transfer(to, amount);
    }

    function totalCirculatingSupply() public view returns(uint256) {
        return totalSupply() - balanceOf(burnWallet1) - balanceOf(burnWallet2);
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
    * @notice Burn ANT Coin tokens
    * @param _amount The amount to mint the tokens
    */

    function burn(address account, uint256 _amount) external override whenNotPaused onlyMinterOrOwner {
        _burn(account, _amount);
    }

    // Function to grant mint role
    function addMinterRole(address _address) external onlyOwner {
        minters[_address] = true;
    }

    // Function to revoke mint role
    function revokeMinterRole(address _address) external onlyOwner {
        minters[_address] = false;
    }

    function setMaxCirculationSupply(uint256 _maxCirculationSupply) external onlyOwner {
        maxCirculationSupply = _maxCirculationSupply;
    }

    /**
    * enables owner to pause / unpause contract
    */
    function setPaused(bool _paused) external onlyOwner {
        if (_paused) _pause();
        else _unpause();
    }

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
    * @notice       Allows owner to withdraw ETH funds to an address
    * @dev          wraps _user in payable to fix address -> address payable
    * @param to     Address for ETH to be send to
    * @param amount Amount of ETH to send
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

    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        whenNotPaused
        override
    {
        super._beforeTokenTransfer(from, to, amount);
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        onlyOwner
        override
    {}
}
