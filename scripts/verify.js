const { ethers } = require("ethers");
const hre = require("hardhat")

const ANTCoinContractAddress = process.env.ANTCoinContractAddress;
const ANTShopContractAddress = process.env.ANTShopContractAddress;
const MarketplaceContractAddress = process.env.MarketplaceContractAddress;
const PremiumANTContractAddress = process.env.PremiumANTContractAddress;
const BasicANTContractAddress = process.env.BasicANTContractAddress;
const PurseContractAddress = process.env.PurseContractAddress;
const RandomizerContractAddress = process.env.RandomizerContractAddress;
const WorkforceContractAddress = process.env.WorkforceContractAddress;
const FoodGatheringContractAddress = process.env.FoodGatheringContractAddress;
const LevelingGroundContractAddress = process.env.LevelingGroundContractAddress;
const ANTLotteryContractAddress = process.env.ANTLotteryContractAddress;
const BossesContractAddress = process.env.BossesContractAddress;
const TasksContractAddress = process.env.TasksContractAddress;
const VestingContractAddress = process.env.VestingContractAddress;
const TreasuryContractAddress = process.env.TreasuryContractAddress;
const polyKeyHash = "0x4b09e658ed251bcafeebbc69400383d49f344ace09b9576fe248bb02c003fe9f";
const polyVrfCoordinator = "0x7a1bac17ccc5b313516c5e16fb24f7659aa5ebed"
const subScriptionId = 5715;

async function main() {
    await hre.run("verify:verify", {
        address: ANTCoinContractAddress,
        constructorArguments: [],
    });

    await hre.run("verify:verify", {
        address: ANTShopContractAddress,
        constructorArguments: [],
    });

    await hre.run("verify:verify", {
        address: MarketplaceContractAddress,
        constructorArguments: [],
    });

    await hre.run("verify:verify", {
        address: PremiumANTContractAddress,
        constructorArguments: [],
    });

    await hre.run("verify:verify", {
        address: BasicANTContractAddress,
        constructorArguments: [],
    });

    await hre.run("verify:verify", {
        address: PurseContractAddress,
        constructorArguments: [],
    });

    await hre.run("verify:verify", {
        address: WorkforceContractAddress,
        constructorArguments: [],
    });

    await hre.run("verify:verify", {
        address: RandomizerContractAddress,
        constructorArguments: [polyKeyHash, polyVrfCoordinator, subScriptionId],
    });

    await hre.run("verify:verify", {
        address: FoodGatheringContractAddress,
        constructorArguments: [],
    });

    await hre.run("verify:verify", {
        address: LevelingGroundContractAddress,
        constructorArguments: [],
    });

    await hre.run("verify:verify", {
        address: ANTLotteryContractAddress,
        constructorArguments: [],
    });

    await hre.run("verify:verify", {
        address: BossesContractAddress,
        constructorArguments: [],
    });

    await hre.run("verify:verify", {
        address: TasksContractAddress,
        constructorArguments: [],
    });

    await hre.run("verify:verify", {
        address: VestingContractAddress,
        constructorArguments: [],
    });

    await hre.run("verify:verify", {
        address: TreasuryContractAddress,
        constructorArguments: [],
    })
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
