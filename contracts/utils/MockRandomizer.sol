//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IRandomizer.sol";
import "../interfaces/IANTLottery.sol";

contract MockRandomizer is IRandomizer, Ownable {
    address public antLottery;
    uint32 public randomResult;
    uint256 public nextRandomResult;
    uint256 public latestLotteryId;

    /**
     * @notice Constructor
     * @dev MockRandomNumberGenerator must be deployed before the lottery.
     */
    constructor() {}

    /**
     * @notice Set the address for the antLottery
     * @param _antLottery: address of the PancakeSwap lottery
     */
    function setLotteryAddress(address _antLottery) external onlyOwner {
        antLottery = _antLottery;
    }

    /**
     * @notice Set the address for the antLottery
     * @param _nextRandomResult: next random result
     */
    function setNextRandomResult(uint256 _nextRandomResult) external onlyOwner {
        nextRandomResult = _nextRandomResult;
    }

    /**
     * @notice Request randomness from a user-provided seed
     */
    function getRandomNumber() external override {
        require(msg.sender == antLottery, "Only antLottery");
        fulfillRandomness(0, nextRandomResult);
    }

    /**
     * @notice Change latest lotteryId to currentLotteryId
     */
    function changeLatestLotteryId() external {
        latestLotteryId = IANTLottery(antLottery).viewCurrentLotteryId();
    }

    /**
     * @notice View latestLotteryId
     */
    function viewLatestLotteryId() external view override returns (uint256) {
        return latestLotteryId;
    }

    /**
     * @notice View random result
     */
    function viewRandomResult() external view override returns (uint32) {
        return randomResult;
    }

    /**
     * @notice Callback function used by ChainLink's VRF Coordinator
     */
    function fulfillRandomness(bytes32 requestId, uint256 randomness) internal {
        randomResult = uint32(1000000 + (randomness % 1000000));
    }

    /**
    * Generate random uint256 from VRF randomResult
    */

    function random() external view returns (uint256) {
        uint256 seed = uint256(keccak256(abi.encodePacked(blockhash(block.number - 1), randomResult)));
        return seed;
    }

    function randomToken(uint256 _tokenId) external view returns (uint256) {
        uint256 seed = uint256(keccak256(abi.encodePacked(blockhash(block.number - 1), randomResult, _tokenId)));
        return seed;
    }
}
