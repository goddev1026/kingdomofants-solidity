// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const { ethers } = require("ethers");
const hre = require("hardhat")

async function main() {
  let RandomizerContractAddress, MockRandomizerContractAddress, ANTCoinContractAddress, ANTShopContractAddress, ANTLotteryContractAddress, PurseContractAddress, MarketplaceContractAddress, BasicANTContractAddress, PremiumANTContractAddress, WorkforceContractAddress, TasksContractAddress, BossesContractAddress, FoodGatheringContractAddress, LevelingGroundContractAddress, VestingContractAddress, TreasuryContractAddress = '';
  const quickSwapMainnetRouterAddress = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";

  [deployer] = await hre.ethers.getSigners();
  // ant coin
  const ANTCoin = await hre.ethers.getContractFactory("ANTCoin");
  console.log("Deploying ANTCoinV1...");
  const ANTCoinContract = await hre.upgrades.deployProxy(ANTCoin, [ethers.parseEther("200000000"), "0x0000000000000000000000000000000000000000", "0x000000000000000000000000000000000000dEaD"], {
    initializer: "initialize",
    kind: "transparent",
  });
  await ANTCoinContract.waitForDeployment();
  ANTCoinContractAddress = await ANTCoinContract.getAddress();

  // ant shop
  const ANTShop = await hre.ethers.getContractFactory("ANTShop");
  console.log("Deploying ANTShopV1...");
  const ANTShopContract = await hre.upgrades.deployProxy(ANTShop, [], {
    initializer: "initialize",
    kind: "transparent",
  });
  await ANTShopContract.waitForDeployment();
  ANTShopContractAddress = await ANTShopContract.getAddress();

  await ANTShopContract.connect(deployer).setTokenTypeInfo(0, "ANTFood", "antshop uri")
  await ANTShopContract.connect(deployer).setTokenTypeInfo(1, "Leveling Potions", "leveling potion uri")

  // basic ant
  const BasicANT = await hre.ethers.getContractFactory("BasicANT");
  console.log("Deploying BasicANTV1...");
  const BasicANTContract = await hre.upgrades.deployProxy(BasicANT, [ANTCoinContractAddress, ANTShopContractAddress], {
    initializer: "initialize",
    kind: "transparent",
  });
  await BasicANTContract.waitForDeployment();
  BasicANTContractAddress = await BasicANTContract.getAddress();

  await ANTShopContract.addMinterRole(BasicANTContractAddress);
  await ANTCoinContract.addMinterRole(BasicANTContractAddress);

  const basicANTMaticMintPrice = ethers.parseEther("0.001")
  const baiscANTANTCoinMintAmount = ethers.parseEther("1000");

  await BasicANTContract.setBatchInfo(0, "Worker ANT", "https://gateway.pinata.cloud/ipfs/QmWsYC3fCyxWb9yBGNTKMfz9QtpApEcWKHhAzCN4StBgvT", basicANTMaticMintPrice, ANTCoinContractAddress, baiscANTANTCoinMintAmount);
  await BasicANTContract.setBatchInfo(1, "Wise ANT", "https://gateway.pinata.cloud/ipfs/QmWsYC3fCyxWb9yBGNTKMfz9QtpApEcWKHhAzCN4StBgvT", basicANTMaticMintPrice, ANTCoinContractAddress, baiscANTANTCoinMintAmount);
  await BasicANTContract.setBatchInfo(2, "Fighter ANT", "https://gateway.pinata.cloud/ipfs/QmWsYC3fCyxWb9yBGNTKMfz9QtpApEcWKHhAzCN4StBgvT", basicANTMaticMintPrice, ANTCoinContractAddress, baiscANTANTCoinMintAmount);

  // premium ant
  const PremiumANT = await hre.ethers.getContractFactory("PremiumANT");
  console.log("Deploying PremiumANTV1...");
  const PremiumANTContract = await hre.upgrades.deployProxy(PremiumANT, [ANTCoinContractAddress, ANTShopContractAddress], {
    initializer: "initialize",
    kind: "transparent",
  });
  await PremiumANTContract.waitForDeployment();
  PremiumANTContractAddress = await PremiumANTContract.getAddress();

  await ANTShopContract.addMinterRole(PremiumANTContractAddress);
  await ANTCoinContract.addMinterRole(PremiumANTContractAddress);

  await PremiumANTContract.setBatchInfo(0, "Worker ANT", "https://gateway.pinata.cloud/ipfs/Qmdq1EUL2cwRXhVHAQ7KNBcfcYW6LKTm7Z1HBNkhaU1Bna/", 100, 1);
  await PremiumANTContract.setBatchInfo(1, "Wise ANT", "https://gateway.pinata.cloud/ipfs/Qmdq1EUL2cwRXhVHAQ7KNBcfcYW6LKTm7Z1HBNkhaU1Bna/", 100, 1);
  await PremiumANTContract.setBatchInfo(2, "Fighter ANT", "https://gateway.pinata.cloud/ipfs/Qmdq1EUL2cwRXhVHAQ7KNBcfcYW6LKTm7Z1HBNkhaU1Bna/", 100, 1);

  // ramdomizer
  const polyKeyHash = "0x4b09e658ed251bcafeebbc69400383d49f344ace09b9576fe248bb02c003fe9f";
  const polyVrfCoordinator = "0x7a1bac17ccc5b313516c5e16fb24f7659aa5ebed"
  const subScriptionId = 5715;
  const Randomizer = await hre.ethers.getContractFactory("Randomizer");
  const RandomizerContract = await Randomizer.deploy(polyKeyHash, polyVrfCoordinator, subScriptionId);
  await RandomizerContract.waitForDeployment();
  RandomizerContractAddress = await RandomizerContract.getAddress();

  // ant lottery
  const ANTLottery = await hre.ethers.getContractFactory("ANTLottery");
  console.log("Deploying ANTLotteryV1...");
  const ANTLotteryContract = await hre.upgrades.deployProxy(ANTLottery, [RandomizerContractAddress, ANTCoinContractAddress], {
    initializer: "initialize",
    kind: "transparent"
  });
  await ANTLotteryContract.waitForDeployment();
  ANTLotteryContractAddress = await ANTLotteryContract.getAddress();
  await ANTLotteryContract.setOperatorAndTreasuryAndInjectorAddresses(deployer.address, deployer.address);
  await RandomizerContract.setLotteryAddress(ANTLotteryContractAddress)


  /*------------------It needs to be confirmed while testing ----------------- */
  const provider = hre.ethers.provider;
  const blockNumber = await provider.getBlockNumber();
  const block = await provider.getBlock(blockNumber);
  const blockTimestamp = block.timestamp;
  const MIN_LENGTH_LOTTERY = await ANTLotteryContract.MIN_LENGTH_LOTTERY();
  await ANTLotteryContract.startLottery(Number(blockTimestamp) + Number(MIN_LENGTH_LOTTERY) + 100, [2000, 2000, 2000, 2000, 1000, 1000]);

  // purse
  const Purse = await hre.ethers.getContractFactory("Purse");
  console.log("Deploying PurseV1...");
  const PurseContract = await hre.upgrades.deployProxy(Purse, [RandomizerContractAddress, ANTShopContractAddress, ANTLotteryContractAddress], {
    initializer: "initialize",
    kind: "transparent"
  });
  await PurseContract.waitForDeployment();
  PurseContractAddress = await PurseContract.getAddress();

  const Marketplace = await hre.ethers.getContractFactory("Marketplace");
  console.log("Deploying MarketplaceV1...");
  const MarketplaceContract = await hre.upgrades.deployProxy(Marketplace, [ANTShopContractAddress, PurseContractAddress, ANTLotteryContractAddress], {
    initializer: "initialize",
    kind: "transparent"
  });
  await MarketplaceContract.waitForDeployment();
  MarketplaceContractAddress = await MarketplaceContract.getAddress();
  await MarketplaceContract.setMintInfo(0, ethers.parseEther("0.0001"), ANTCoinContractAddress, ethers.parseEther("100"));
  await MarketplaceContract.setMintInfo(1, ethers.parseEther("0.001"), ANTCoinContractAddress, ethers.parseEther("100"));
  await ANTShopContract.addMinterRole(MarketplaceContractAddress);
  await ANTLotteryContract.addMinterRole(MarketplaceContractAddress);
  await ANTShopContract.addMinterRole(PurseContractAddress);
  await ANTLotteryContract.addMinterRole(PurseContractAddress);
  await ANTCoinContract.addMinterRole(ANTLotteryContractAddress);
  await PurseContract.addMinterRole(MarketplaceContractAddress);
  await PurseContract.addMultiPurseCategories(["Common", "UnCommon", "Rare", "Ultra Rare", "Legendary"], [45, 25, 20, 7, 3], [20, 5, 25, 25, 35], [5, 20, 25, 25, 35], [75, 75, 50, 50, 30], [5, 10, 10, 20, 50], [1, 1, 1, 2, 5], [10, 25, 30, 50, 100], [0, 0, 0, 0, 0]);
  await MarketplaceContract.setPurseMintInfo(true, ethers.parseEther("3"), ANTCoinContractAddress, ethers.parseEther("100"));
  await MarketplaceContract.setLotteryTicketMintInfo(true, ethers.parseEther("0.06"), ANTCoinContractAddress, ethers.parseEther("100"))

  // bosses
  const Bosses = await hre.ethers.getContractFactory('Bosses');
  console.log("Deploying BossesV1...");
  const BossesContract = await hre.upgrades.deployProxy(Bosses, [RandomizerContractAddress, ANTCoinContractAddress, PremiumANTContractAddress, BasicANTContractAddress], {
    initializer: "initialize",
    kind: "transparent"
  });
  await BossesContract.waitForDeployment();
  BossesContractAddress = await BossesContract.getAddress();

  await ANTCoinContract.addMinterRole(BossesContractAddress);
  await PremiumANTContract.addMinterRole(BossesContractAddress);
  await BasicANTContract.addMinterRole(BossesContractAddress);
  await BossesContract.setBossesPoolsInfo(["Catepillar", "Snail", "Beetle", "Snake", "Anteater"], [20, 50, 100, 250, 600], [5, 10, 18, 25, 40], [5, 10, 18, 25, 40])

  // food fathering
  const FoodGathering = await hre.ethers.getContractFactory("FoodGathering");
  console.log("Deploying FoodGatheringV1...");
  const FoodGatheringContract = await hre.upgrades.deployProxy(FoodGathering, [ANTCoinContractAddress, ANTShopContractAddress], {
    initializer: "initialize",
    kind: "transparent"
  });
  await FoodGatheringContract.waitForDeployment();
  FoodGatheringContractAddress = await FoodGatheringContract.getAddress();
  await ANTCoinContract.addMinterRole(FoodGatheringContractAddress);
  await ANTShopContract.addMinterRole(FoodGatheringContractAddress);

  // leveling ground
  const LevelingGround = await hre.ethers.getContractFactory("LevelingGround");
  console.log("Deploying LevelingGroundV1...");
  const LevelingGroundContract = await hre.upgrades.deployProxy(LevelingGround, [ANTCoinContractAddress, PremiumANTContractAddress, BasicANTContractAddress], {
    initializer: "initialize",
    kind: "transparent"
  });
  await LevelingGroundContract.waitForDeployment();
  LevelingGroundContractAddress = await LevelingGroundContract.getAddress();

  await PremiumANTContract.addMinterRole(LevelingGroundContractAddress);
  await BasicANTContract.addMinterRole(LevelingGroundContractAddress);
  await ANTCoinContract.addMinterRole(LevelingGroundContractAddress)

  // tasks
  const Tasks = await hre.ethers.getContractFactory("Tasks");
  console.log("Deploying TasksV1...");
  const TasksContract = await hre.upgrades.deployProxy(Tasks, [RandomizerContractAddress, ANTCoinContractAddress, PremiumANTContractAddress, BasicANTContractAddress, PurseContractAddress], {
    initializer: "initialize",
    kind: "transparent"
  });
  await TasksContract.waitForDeployment();
  TasksContractAddress = await TasksContract.getAddress();
  await TasksContract.setRewardLevels([[5, 19], [10, 25], [19, 40], [25, 40], [30, 40]])
  await TasksContract.setRewardsAmount([1, 2, 3, 4, 5]);

  await ANTCoinContract.addMinterRole(TasksContractAddress);
  await PremiumANTContract.addMinterRole(TasksContractAddress);
  await BasicANTContract.addMinterRole(TasksContractAddress);
  await PurseContract.addMinterRole(TasksContractAddress)

  // workforce
  const Workforce = await hre.ethers.getContractFactory("Workforce");
  console.log("Deploying WorkforceV1...");
  const WorkforceContract = await hre.upgrades.deployProxy(Workforce, [ANTCoinContractAddress, PremiumANTContractAddress, BasicANTContractAddress], {
    initializer: "initialize",
    kind: "transparent"
  });
  await WorkforceContract.waitForDeployment();
  WorkforceContractAddress = await WorkforceContract.getAddress();
  await ANTCoinContract.addMinterRole(WorkforceContractAddress);
  await PremiumANTContract.addMinterRole(WorkforceContractAddress);
  await BasicANTContract.addMinterRole(WorkforceContractAddress);

  // vesting
  const Vesting = await hre.ethers.getContractFactory("Vesting");
  console.log("Deploying VestingV1...");
  const VestingContract = await hre.upgrades.deployProxy(Vesting, [ANTCoinContractAddress], {
    initializer: "initialize",
    kind: "transparent"
  });
  await VestingContract.waitForDeployment();
  VestingContractAddress = await VestingContract.getAddress();
  await ANTCoinContract.addMinterRole(VestingContractAddress);
  await VestingContract.addVestingPoolInfo("Private sale", 20, 9);
  await VestingContract.addVestingPoolInfo("Public sale", 40, 6);
  await VestingContract.addVestingPoolInfo("Team", 10, 12);
  await VestingContract.addVestingPoolInfo("Advisory", 10, 12);
  await VestingContract.addVestingPoolInfo("Reserve", 0, 12);
  await VestingContract.addVestingPoolInfo("Foundation", 10, 24)

  // treasury

  const Treasury = await hre.ethers.getContractFactory("Treasury");
  const TreasuryContract = await hre.upgrades.deployProxy(Treasury, [quickSwapMainnetRouterAddress, ANTCoinContractAddress], {
    initializer: "initialize",
    kind: "transparent"
  });
  await TreasuryContract.waitForDeployment();
  TreasuryContractAddress = await TreasuryContract.getAddress();

  /** ----------Test Versoin -------------- */

  await BossesContract.setStakePeriod(25920); // 0.3 day
  await FoodGatheringContract.setCycleTimestamp(864); // 0.24 hours
  await LevelingGroundContract.setFullCyclePeriod(72000); // 20 hours
  await TasksContract.setStakePeriod(25920); // 0.3 day
  await VestingContract.setReleaseCycle(25920); // 0.3 day
  await WorkforceContract.setMaxStakePeriod(3600 * 24 * 30); // 30 days
  await WorkforceContract.setCycleStakePeriod(3600 * 24 * 10); // 10 days
  await BasicANTContract.setBatchInfo(0, "Worker ANT", "https://gateway.pinata.cloud/ipfs/QmWsYC3fCyxWb9yBGNTKMfz9QtpApEcWKHhAzCN4StBgvT", ethers.parseEther("30"), ANTCoinContractAddress, baiscANTANTCoinMintAmount);
  await MarketplaceContract.setMintInfo(0, ethers.parseEther("0.6"), ANTCoinContractAddress, ethers.parseEther("100"));
  await MarketplaceContract.setMintInfo(1, ethers.parseEther("3"), ANTCoinContractAddress, ethers.parseEther("100"));
  await MarketplaceContract.setPurseMintInfo(true, ethers.parseEther("3"), ANTCoinContractAddress, ethers.parseEther("100"));
  await MarketplaceContract.setLotteryTicketMintInfo(true, ethers.parseEther("0.06"), ANTCoinContractAddress, ethers.parseEther("100"))
  await PremiumANTContract.setBatchInfo(0, "Worker ANT", "https://gateway.pinata.cloud/ipfs/Qmdq1EUL2cwRXhVHAQ7KNBcfcYW6LKTm7Z1HBNkhaU1Bna/", 100, 30)

  console.log("ANTCoin Contract Address:", ANTCoinContractAddress);
  console.log("ANTShop Contract Address:", ANTShopContractAddress);
  console.log("Marketplace Contract Address:", MarketplaceContractAddress);
  console.log("PremiumANT Contract Address:", PremiumANTContractAddress);
  console.log("BasicANT Contract Address:", BasicANTContractAddress);
  console.log("Purse Contract Address:", PurseContractAddress);
  console.log("Randomizer Contract Address:", RandomizerContractAddress);
  console.log("Workforce Contract Address:", WorkforceContractAddress);
  console.log("FoodGathering Contract Address:", FoodGatheringContractAddress);
  console.log("LevelingGround Contract Address:", LevelingGroundContractAddress);
  console.log("ANTLottery Contract Address:", ANTLotteryContractAddress);
  console.log("Bosses Contract Address:", BossesContractAddress);
  console.log("Tasks Contract Address:", TasksContractAddress);
  console.log("Vesting Contract Address:", VestingContractAddress);
  console.log("Treasury Contract Address:", TreasuryContractAddress);

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
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
