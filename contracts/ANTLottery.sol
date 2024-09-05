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

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import '@openzeppelin/contracts/utils/Strings.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import './interfaces/IRandomizer.sol';
import './interfaces/IANTCoin.sol';
import './interfaces/IANTLottery.sol';  

contract ANTLottery is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable, UUPSUpgradeable, IANTLottery {

    using Strings for uint256;
    using SafeMath for uint256;

    // Reference to randomizer
    IRandomizer public randomizer;
    // Reference to ant coin
    IANTCoin public antCoin;

    address public injectorAddress;
    address public operatorAddress;
    address public treasuryAddress;

    uint256 public currentLotteryId;
    uint256 public currentTicketId;

    uint256 public maxNumberTicketPerBuyOrClaim;

    uint256 public pendingInjectionNextLottery;

    uint256 public antCoinAmountPerTicket; // 300 ant coins

    uint256 public MIN_LENGTH_LOTTERY;
    uint256 public MAX_LENGTH_LOTTERY;

    // uint256 public constant MIN_LENGTH_LOTTERY = 5 minutes - 10 seconds;
    // uint256 public constant MAX_LENGTH_LOTTERY = 5 minutes + 10 seconds;

    // The sum of the values below must be 100.
    uint256 public injectionNextLotteryPercentage;
    uint256 public burnPercentage;

    // lottery id status    
    enum Status {
        Pending,
        Open,
        Close,
        Claimable
    }

    struct Lottery {
        Status status;
        uint256 startTime;
        uint256 endTime;
        uint256[6] rewardsBreakdown; // 0: 1 matching number //5: 6 matching number
        uint256[6] antCoinPerBracket;
        uint256[6] countWinnersPerBracket;
        uint256 firstTicketId;
        uint256 firstTicketIdNextLottery;
        uint256 amountCollectedInAntCoin;
        uint256 finalNumber;
    }

    struct Ticket {
        uint256 number;
        address owner;
    }

    // minters
    mapping(address => bool) private minters;

    // Mapping are cheaper than arrays
    mapping(uint256 => Lottery) private _lotteries;
    mapping(uint256 => Ticket) private _tickets;

    // Bracket calculator is used for verifying claims for ticket prizes
    mapping(uint256 => uint256) private _bracketCalculator;

    // Keeps track of number of ticket per unique combination for each lotteryId
    mapping(uint256 => mapping(uint256 => uint256)) private _numberTicketsPerLotteryId;

    // Keep track of user ticket ids for a given lotteryId
    mapping(address => mapping(uint256 => uint256[])) private _userTicketIdsPerLotteryId;

    modifier onlyMinterOrOwner() {
        require(minters[_msgSender()] || _msgSender() == owner(), "ANTLottery: Caller is not the owner or minter");
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operatorAddress, "Not operator");
        _;
    }

    modifier onlyOwnerOrInjector() {
        require((msg.sender == owner()) || (msg.sender == injectorAddress), "Not owner or injector");
        _;
    }

    event AdminTokenRecovery(address token, uint256 amount);
    event LotteryClose(uint256 indexed lotteryId, uint256 firstTicketIdNextLottery);
    event LotteryInjection(uint256 indexed lotteryId, uint256 injectedAmount);
    event LotteryOpen(
        uint256 indexed lotteryId,
        uint256 startTime,
        uint256 endTime,
        uint256 firstTicketId,
        uint256 injectedAmount
    );
    event LotteryNumberDrawn(uint256 indexed lotteryId, uint256 finalNumber, uint256 countWinningTickets);
    event NewOperatorAndTreasuryAndInjectorAddresses(address operator, address injector);
    event NewRandomGenerator(address indexed randomGenerator);
    event TicketsPurchase(address indexed buyer, uint256 indexed lotteryId, uint256 numberTickets);
    event TicketsClaim(address indexed claimer, uint256 amount, uint256 indexed lotteryId, uint256 numberTickets);
    
    constructor () {
       
    }

    function initialize(IRandomizer _randomizer, IANTCoin _antCoin) initializer public {
        __Pausable_init();
        __Ownable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        antCoin = _antCoin;
        randomizer = _randomizer;
        minters[_msgSender()] = true;

        // Initializes a mapping
        _bracketCalculator[0] = 1;
        _bracketCalculator[1] = 11;
        _bracketCalculator[2] = 111;
        _bracketCalculator[3] = 1111;
        _bracketCalculator[4] = 11111;
        _bracketCalculator[5] = 111111;

        maxNumberTicketPerBuyOrClaim = 100;
        antCoinAmountPerTicket = 300 ether; // 300 ant coins
        MIN_LENGTH_LOTTERY = 7 days - 1 hours;
        MAX_LENGTH_LOTTERY = 7 days + 1 hours;

        injectionNextLotteryPercentage = 60;
        burnPercentage = 40;
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

    function reverseUint256(uint256 x) public pure returns (uint256) {
        uint256 result = 0;
        while (x > 0) {
            result = result * 10 + x % 10;
            x = x / 10;
        }
        return result;
    }

    /**
     * @notice              Calculate rewards for a given ticket
     * @param _lotteryId:   lottery id
     * @param _ticketId:    ticket id
     * @param _bracket:     bracket for the ticketId to verify the claim and calculate rewards
     */
    function _calculateRewardsForTicketId(
        uint256 _lotteryId,
        uint256 _ticketId,
        uint256 _bracket
    ) internal view returns (uint256) {
        // Retrieve the winning number combination
        uint256 winningTicketNumber = _lotteries[_lotteryId].finalNumber;

        // Retrieve the user number combination from the ticketId
        uint256 userNumber = _tickets[_ticketId].number;

        // Apply transformation to verify the claim provided by the user is true
        uint256 transformedWinningNumber = _bracketCalculator[_bracket] +
            (winningTicketNumber % (uint256(10)**(_bracket + 1)));

        uint256 transformedUserNumber = _bracketCalculator[_bracket] + (userNumber % (uint256(10)**(_bracket + 1)));

        // Confirm that the two transformed numbers are the same, if not throw
        if (transformedWinningNumber == transformedUserNumber) {
            return _lotteries[_lotteryId].antCoinPerBracket[_bracket];
        } else {
            return 0;
        }
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
     * @notice View current lottery id
     */
    function viewCurrentLotteryId() external view override returns (uint256) {
        return currentLotteryId;
    }

    /**
     * @notice              Claim a set of winning tickets for a lottery
     * @param _lotteryId:   lottery id
     * @param _ticketIds:   array of ticket ids
     * @param _brackets:    array of brackets for the ticket ids
     * @dev                 Callable by users only, not contract!
     */
    function claimTickets(uint256 _lotteryId, uint256[] calldata _ticketIds, uint256[] calldata _brackets) external nonReentrant whenNotPaused {
        require(_ticketIds.length == _brackets.length, "ANTLottery: Not same length");
        require(_ticketIds.length != 0, "ANTLottery: Length must be >0");
        require(_lotteries[_lotteryId].status == Status.Claimable, "ANTLottery: Lottery not claimable");

        // Initializes the rewardInAntCoinToTransfer
        uint256 rewardInAntCoinToTransfer;

        for (uint256 i = 0; i < _ticketIds.length; i++) {
            require(_brackets[i] < 6, "ANTLottery: Bracket out of range"); // Must be between 0 and 5

            uint256 thisTicketId = _ticketIds[i];

            require(_lotteries[_lotteryId].firstTicketIdNextLottery > thisTicketId, "ANTLottery: TicketId too high");
            require(_lotteries[_lotteryId].firstTicketId <= thisTicketId, "ANTLottery: TicketId too low");
            require(msg.sender == _tickets[thisTicketId].owner, "ANTLottery: Not the owner");

            // Update the lottery ticket owner to 0x address
            _tickets[thisTicketId].owner = address(0);

            uint256 rewardForTicketId = _calculateRewardsForTicketId(_lotteryId, thisTicketId, _brackets[i]);

            // Check user is claiming the correct bracket
            require(rewardForTicketId != 0, "ANTLottery: No prize for this bracket");

            if (_brackets[i] != 5) {
                require(
                    _calculateRewardsForTicketId(_lotteryId, thisTicketId, _brackets[i] + 1) == 0,
                    "ANTLottery: Bracket must be higher"
                );
            }

            // Increment the reward to transfer
            rewardInAntCoinToTransfer += rewardForTicketId;
        }

        // Transfer money to msg.sender
        antCoin.transfer(msg.sender, rewardInAntCoinToTransfer);

        emit TicketsClaim(msg.sender, rewardInAntCoinToTransfer, _lotteryId, _ticketIds.length);
    }

    /**
     * @notice              View lottery information
     * @param _lotteryId:   lottery id
     */
    function viewLottery(uint256 _lotteryId) external view returns (Lottery memory) {
        return _lotteries[_lotteryId];
    }

    /**
     * @notice              View ticker statuses and numbers for an array of ticket ids
     * @param _ticketIds:   array of _ticketId
     */
    function viewNumbersAndStatusesForTicketIds(uint256[] calldata _ticketIds) external view returns (uint256[] memory, bool[] memory) {
        uint256 length = _ticketIds.length;
        uint256[] memory ticketNumbers = new uint256[](length);
        bool[] memory ticketStatuses = new bool[](length);

        for (uint256 i = 0; i < length; i++) {
            ticketNumbers[i] = _tickets[_ticketIds[i]].number;
            if (_tickets[_ticketIds[i]].owner == address(0)) {
                ticketStatuses[i] = true;
            } else {
                ticketStatuses[i] = false;
            }
        }

        return (ticketNumbers, ticketStatuses);
    }

    /**
     * @notice              View rewards for a given ticket, providing a bracket, and lottery id
     * @dev                 Computations are mostly offchain. This is used to verify a ticket!
     * @param _lotteryId:   lottery id
     * @param _ticketId:    ticket id
     * @param _bracket:     bracket for the ticketId to verify the claim and calculate rewards
     */
    function viewRewardsForTicketId(uint256 _lotteryId, uint256 _ticketId, uint256 _bracket) external view returns (uint256) {
        // Check lottery is in claimable status
        if (_lotteries[_lotteryId].status != Status.Claimable) {
            return 0;
        }

        // Check ticketId is within range
        if (
            (_lotteries[_lotteryId].firstTicketIdNextLottery < _ticketId) &&
            (_lotteries[_lotteryId].firstTicketId >= _ticketId)
        ) {
            return 0;
        }

        return _calculateRewardsForTicketId(_lotteryId, _ticketId, _bracket);
    }

    /**
     * @notice              View user ticket ids, numbers, and statuses of user for a given lottery
     * @param _user:        user address
     * @param _lotteryId:   lottery id
     * @param _cursor:      cursor to start where to retrieve the tickets
     * @param _size:        the number of tickets to retrieve
     */
    function viewUserInfoForLotteryId(address _user, uint256 _lotteryId, uint256 _cursor, uint256 _size) external view override returns (uint256[] memory, uint256[] memory, bool[] memory, uint256)
    {
        uint256 length = _size;
        uint256 numberTicketsBoughtAtLotteryId = _userTicketIdsPerLotteryId[_user][_lotteryId].length;

        if (length > (numberTicketsBoughtAtLotteryId - _cursor)) {
            length = numberTicketsBoughtAtLotteryId - _cursor;
        }

        uint256[] memory lotteryTicketIds = new uint256[](length);
        uint256[] memory ticketNumbers = new uint256[](length);
        bool[] memory ticketStatuses = new bool[](length);

        for (uint256 i = 0; i < length; i++) {
            lotteryTicketIds[i] = _userTicketIdsPerLotteryId[_user][_lotteryId][i + _cursor];
            ticketNumbers[i] = _tickets[lotteryTicketIds[i]].number;

            // True = ticket claimed
            if (_tickets[lotteryTicketIds[i]].owner == address(0)) {
                ticketStatuses[i] = true;
            } else {
                // ticket not claimed (includes the ones that cannot be claimed)
                ticketStatuses[i] = false;
            }
        }

        return (lotteryTicketIds, ticketNumbers, ticketStatuses, _cursor + length);
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
     * @notice                      Start the lottery
     * @dev                         Callable by operator
     * @param _endTime:             endTime of the lottery
     * @param _rewardsBreakdown:    breakdown of rewards per bracket (must sum to 10,000)
     */
    function startLottery(uint256 _endTime, uint256[6] calldata _rewardsBreakdown) external override onlyOperator {
        require((currentLotteryId == 0) || (_lotteries[currentLotteryId].status == Status.Claimable), "ANTLottery: Not time to start lottery");
        require(((_endTime - block.timestamp) > MIN_LENGTH_LOTTERY) && ((_endTime - block.timestamp) < MAX_LENGTH_LOTTERY), "ANTLottery: Lottery length outside of range");
        require((_rewardsBreakdown[0] + _rewardsBreakdown[1] + _rewardsBreakdown[2] + _rewardsBreakdown[3] + _rewardsBreakdown[4] + _rewardsBreakdown[5]) == 10000, "ANTLottery: Rewards must equal 10000");
    
        currentLotteryId++;

        _lotteries[currentLotteryId] = Lottery({
            status: Status.Open,
            startTime: block.timestamp,
            endTime: _endTime,
            rewardsBreakdown: _rewardsBreakdown,
            antCoinPerBracket: [uint256(0), uint256(0), uint256(0), uint256(0), uint256(0), uint256(0)],
            countWinnersPerBracket: [uint256(0), uint256(0), uint256(0), uint256(0), uint256(0), uint256(0)],
            firstTicketId: currentTicketId,
            firstTicketIdNextLottery: currentTicketId,
            amountCollectedInAntCoin: pendingInjectionNextLottery,
            finalNumber: 0
        });

        emit LotteryOpen(currentLotteryId, block.timestamp, _endTime, currentTicketId, pendingInjectionNextLottery);

        pendingInjectionNextLottery = 0;
    }

    /**
     * @notice              Close lottery
     * @param _lotteryId:   lottery id
     * @dev                 Callable by operator
     */
    function closeLottery(uint256 _lotteryId) external override onlyOperator nonReentrant {
        require(_lotteries[_lotteryId].status == Status.Open, "ANTLottery: Lottery not open");
        require(block.timestamp > _lotteries[_lotteryId].endTime, "ANTLottery: Lottery not over");
        _lotteries[_lotteryId].firstTicketIdNextLottery = currentTicketId;

        // Request a random number from the generator based on a seed
        randomizer.getRandomNumber();

        _lotteries[_lotteryId].status = Status.Close;

        emit LotteryClose(_lotteryId, currentTicketId);
    }

    /**
     * @notice              Buy tickets for the current lottery
     * @dev                 Callable by minter
     * @param _recipient:   recipient address 
     * @param _quantity:    tickets quantity
     */
    function buyTickets(address _recipient, uint256 _quantity) external override onlyMinterOrOwner nonReentrant whenNotPaused {
        require(_quantity != 0, "No ticket specified");
        require(_lotteries[currentLotteryId].status == Status.Open, "ANTLottery: Lottery is not open");
        require(block.timestamp < _lotteries[currentLotteryId].endTime, "ANTLottery: Lottery is over");

        uint256 amountANTForTransfer = antCoinAmountPerTicket * _quantity;

        // Increment the total amount collected for the lottery round
        _lotteries[currentLotteryId].amountCollectedInAntCoin += amountANTForTransfer;

        for (uint256 i = 0; i < _quantity; i++) {
            uint256 thisTicketNumber = reverseUint256(randomizer.randomToken(block.timestamp + currentLotteryId + i) % 1000000) + 1000000;
            require((thisTicketNumber >= 1000000) && (thisTicketNumber <= 1999999), "ANTLottery: Outside range");

            _numberTicketsPerLotteryId[currentLotteryId][1 + (thisTicketNumber % 10)]++;
            _numberTicketsPerLotteryId[currentLotteryId][11 + (thisTicketNumber % 100)]++;
            _numberTicketsPerLotteryId[currentLotteryId][111 + (thisTicketNumber % 1000)]++;
            _numberTicketsPerLotteryId[currentLotteryId][1111 + (thisTicketNumber % 10000)]++;
            _numberTicketsPerLotteryId[currentLotteryId][11111 + (thisTicketNumber % 100000)]++;
            _numberTicketsPerLotteryId[currentLotteryId][111111 + (thisTicketNumber % 1000000)]++;

            _userTicketIdsPerLotteryId[_recipient][currentLotteryId].push(currentTicketId);

            _tickets[currentTicketId] = Ticket({number: thisTicketNumber, owner: _recipient});

            // Increase lottery ticket number
            currentTicketId++;
        }

        antCoin.mint(address(this), amountANTForTransfer);
        emit TicketsPurchase(_recipient, currentLotteryId, _quantity);
    }

    /**
     * @notice              Draw the final number, calculate reward in AntCoin per group, and make lottery claimable
     * @param _lotteryId:   lottery id
     * @dev                 Callable by operator
     */
    function drawFinalNumberAndMakeLotteryClaimable(uint256 _lotteryId) external override onlyOperator nonReentrant {
        require(_lotteries[_lotteryId].status == Status.Close, "ANTLottery: Lottery not close");
        require(_lotteryId == randomizer.viewLatestLotteryId(), "ANTLottery: Numbers not drawn");

        // Calculate the finalNumber based on the randomResult generated by ChainLink's fallback
        uint256 finalNumber = randomizer.viewRandomResult();

        // Initialize a number to count addresses in the previous bracket
        uint256 numberAddressesInPreviousBracket;

        // Calculate the amount to share post-treasury fee
        uint256 amountToShareToWinners = _lotteries[_lotteryId].amountCollectedInAntCoin;

        // Initializes the amount to withdraw to treasury
        uint256 amountToWithdrawToTreasury;

        // Calculate prizes in AntCoin for each bracket by starting from the highest one
        for (uint256 i = 0; i < 6; i++) {
            uint256 j = 5 - i;
            uint256 transformedWinningNumber = _bracketCalculator[j] + (finalNumber % (uint256(10)**(j + 1)));

            _lotteries[_lotteryId].countWinnersPerBracket[j] =
                _numberTicketsPerLotteryId[_lotteryId][transformedWinningNumber] -
                numberAddressesInPreviousBracket;

            // A. If number of users for this _bracket number is superior to 0
            if (
                (_numberTicketsPerLotteryId[_lotteryId][transformedWinningNumber] - numberAddressesInPreviousBracket) !=
                0
            ) {
                // B. If rewards at this bracket are > 0, calculate, else, report the numberAddresses from previous bracket
                if (_lotteries[_lotteryId].rewardsBreakdown[j] != 0) {
                    _lotteries[_lotteryId].antCoinPerBracket[j] =
                        ((_lotteries[_lotteryId].rewardsBreakdown[j] * amountToShareToWinners) /
                            (_numberTicketsPerLotteryId[_lotteryId][transformedWinningNumber] -
                                numberAddressesInPreviousBracket)) /
                        10000;

                    // Update numberAddressesInPreviousBracket
                    numberAddressesInPreviousBracket = _numberTicketsPerLotteryId[_lotteryId][transformedWinningNumber];
                }
                // A. No ANTCoin to distribute, they are added to the amount to withdraw to treasury address
            } else {
                _lotteries[_lotteryId].antCoinPerBracket[j] = 0;

                amountToWithdrawToTreasury +=
                    (_lotteries[_lotteryId].rewardsBreakdown[j] * amountToShareToWinners) /
                    10000;
            }
        }

        // Update internal statuses for lottery
        _lotteries[_lotteryId].finalNumber = finalNumber;
        _lotteries[_lotteryId].status = Status.Claimable;
        pendingInjectionNextLottery = amountToWithdrawToTreasury.mul(injectionNextLotteryPercentage).div(100);
        antCoin.burn(address(this), amountToWithdrawToTreasury.mul(burnPercentage).div(100));

        emit LotteryNumberDrawn(currentLotteryId, finalNumber, numberAddressesInPreviousBracket);
    }

    /**
     * @notice  Change the random generator
     * @dev     The calls to functions are used to verify the new generator implements them properly.
     * It is necessary to wait for the VRF response before starting a round.
     * Callable only by the contract owner
     * @param _randomGeneratorAddress: address of the random generator
     */
    function changeRandomGenerator(address _randomGeneratorAddress) external onlyMinterOrOwner {
        require(
            (currentLotteryId == 0) || (_lotteries[currentLotteryId].status == Status.Claimable),
            "ANTLottery: Lottery not in claimable"
        );

        // Request a random number from the generator based on a seed
        IRandomizer(_randomGeneratorAddress).getRandomNumber();

        // Calculate the finalNumber based on the randomResult generated by ChainLink's fallback
        IRandomizer(_randomGeneratorAddress).viewRandomResult();

        randomizer = IRandomizer(_randomGeneratorAddress);

        emit NewRandomGenerator(_randomGeneratorAddress);
    }

    /**
     * @notice              Inject funds
     * @param _lotteryId:   lottery id
     * @param _amount:      amount to inject in AntCoin token
     * @dev                 Callable by owner or injector address
     */
    function injectFunds(uint256 _lotteryId, uint256 _amount) external override onlyOwnerOrInjector {
        require(_lotteries[_lotteryId].status == Status.Open, "ANTLottery: Lottery not open");

        antCoin.transferFrom(address(msg.sender), address(this), _amount);
        _lotteries[_lotteryId].amountCollectedInAntCoin += _amount;

        emit LotteryInjection(_lotteryId, _amount);
    }

    /**
     * @notice                  It allows the admin to recover wrong tokens sent to the contract
     * @param _tokenAddress:    the address of the token to withdraw
     * @param _tokenAmount:     the number of token amount to withdraw
     * @dev                     Only callable by owner.
     */
    function recoverWrongTokens(address _tokenAddress, uint256 _tokenAmount) external onlyMinterOrOwner {
        require(_tokenAddress != address(antCoin), "ANTLottery: Cannot be ANT Coin token");

        IERC20(_tokenAddress).transfer(address(msg.sender), _tokenAmount);

        emit AdminTokenRecovery(_tokenAddress, _tokenAmount);
    }

    /**
     * @notice                  Set operator, and injector addresses
     * @dev                     Only callable by owner
     * @param _operatorAddress: address of the operator
     * @param _injectorAddress: address of the injector
     */
    function setOperatorAndTreasuryAndInjectorAddresses(
        address _operatorAddress,
        address _injectorAddress
    ) external onlyMinterOrOwner {
        require(_operatorAddress != address(0), "Cannot be zero address");
        require(_injectorAddress != address(0), "Cannot be zero address");

        operatorAddress = _operatorAddress;
        injectorAddress = _injectorAddress;

        emit NewOperatorAndTreasuryAndInjectorAddresses(_operatorAddress, _injectorAddress);
    }

    /**
     * @notice                          Set ant coin amount per lottery ticket
     * @dev                             This function can only be called by the owner
     * @param _antCoinAmountPerTicket   ant coin amount
     */

    function setANTCoinAmountPerTicket(uint256 _antCoinAmountPerTicket) external onlyMinterOrOwner {
        antCoinAmountPerTicket = _antCoinAmountPerTicket;
    }

    /**
     * @notice                      Set injection and burn percentage
     * @dev                         This function can only be called by the owner
     * @param _injectionPercentage  injection percentage, default = 60
     * @param _burnPercentage       burn percentage, default = 40
     */

    function setInjectionPercentage(uint256 _injectionPercentage, uint256 _burnPercentage) external onlyMinterOrOwner {
        require(_injectionPercentage + _burnPercentage == 100, "ANTLottery: the sum of these values should be 100");
        injectionNextLotteryPercentage = _injectionPercentage;
        burnPercentage = _burnPercentage;
    }

    /**
     * @notice Set a randomizer contract address
     * @dev This function can only be called by the owner
     * @param _randomizer the randomizer address
     */

    function setRandomizerContract(IRandomizer _randomizer) external onlyOwner {
        require(address(_randomizer) != address(0x0), "ANTLottery: randomizer contract address can't be null");
        randomizer = _randomizer;
    }

    /**
    * @notice Function to grant mint role
    * @param _address address to get minter role
    */
    function addMinterRole(address _address) external onlyOwner {
        minters[_address] = true;
    }

    /**
    * @notice           Function to revoke mint role
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