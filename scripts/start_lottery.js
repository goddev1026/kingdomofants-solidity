const { ethers } = require("hardhat");
const hre = require("hardhat");
const lotteryABI = require("./antlotteryABI.json")

async function main() {
    // Get the signers from the hardhat environment
    const [deployer] = await ethers.getSigners();
    const myContractAddress = "0xa2Bfe3231c747FdA05f80AF1a068cd14583E059e"; // replace with your contract's address

    // Create an instance of the contract using the ABI and address
    const ANTLotteryContract = new ethers.Contract(myContractAddress, lotteryABI, deployer);

    await ANTLotteryContract.closeLottery(2);
    await ANTLotteryContract.drawFinalNumberAndMakeLotteryClaimable(2);

    const provider = ethers.provider;
    const blockNumber = await provider.getBlockNumber();
    const block = await provider.getBlock(blockNumber);
    const blockTimestamp = block.timestamp;
    console.log(blockTimestamp)
    const MIN_LENGTH_LOTTERY = await ANTLotteryContract.MIN_LENGTH_LOTTERY();
    const endTime = Number(blockTimestamp) + Number(MIN_LENGTH_LOTTERY) + 200;
    await ANTLotteryContract.startLottery(endTime, [2000, 2000, 2000, 2000, 1000, 1000]);

    console.log(`Result: good`);
}
// Execute the main function
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
