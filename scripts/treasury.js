const { ethers } = require("ethers");
const hre = require("hardhat");
const treasuryABI = require("../artifacts/contracts/Treasury.sol/Treasury.json")
const ANTCoinABI = require("../artifacts/contracts/ANTCoin.sol/ANTCoin.json")
const quickSwapRouterABI = require("../test/abi/Router.json")
const quickSwapFactoryABI = require("../test/abi/QuickswapFactory.json")

async function main() {
    // Get the signers from the hardhat environment
    const [deployer] = await hre.ethers.getSigners();
    const antCoinAddress = "0x759fca30c173Ed2a273D6531436eC9fe4EAe3Bf1"
    const treasuryAddress = "0xdF801571aC92E6030BAcAE7beE95a2a35d26BdB9"; // replace with your contract's address
    const quickSwapRouterAddres = "0x8954AfA98594b838bda56FE4C12a09D7739D179b";
    const quickSwapFactoryAddress = "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32"
    const wETHAddress = "0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889";
    const TreasuryContract = new hre.ethers.Contract(treasuryAddress, treasuryABI.abi, deployer);
    /** -------------------- add liquidity --------------- */
    // // Create an instance of the contract using the ABI and address
    // const ANTCoinContract = new hre.ethers.Contract(antCoinAddress, ANTCoinABI.abi, deployer);
    // const quickSwapRouterContract = new hre.ethers.Contract(quickSwapRouterAddres, quickSwapRouterABI, deployer);
    // const quickSwapFactoryContract = new hre.ethers.Contract(quickSwapFactoryAddress, quickSwapFactoryABI, deployer)
    // // await quickSwapFactoryContract.connect(deployer).createPair(antCoinAddress, wETHAddress)
    // await ANTCoinContract.approve(quickSwapRouterContract, ethers.parseEther("1000000"));
    // await quickSwapRouterContract.connect(deployer).addLiquidityETH(antCoinAddress, ethers.parseEther("1000000"), 0, 0, deployer.address, Date.now() + 1000, {
    //     value: ethers.parseEther('10'),
    // })

    /** add assets */

    await TreasuryContract.addActiveAssets([[wMaticAddress, [wMaticAddress, usdtAddress]]]);

    console.log(`Result: good`);
}
// Execute the main function
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
