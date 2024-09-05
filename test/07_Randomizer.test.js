const { expect } = require("chai");
const { ethers } = require("ethers");
const hre = require("hardhat")
const { network } = require("hardhat")

describe.skip("Randomizer", function () {
    let Randomizer, RandomizerContract;

    beforeEach(async function () {
        [deployer, controller, badActor, user1, user2, user3, ...user] = await hre.ethers.getSigners();

        // Randomizer smart contract deployment
                // Randomizer smart contract deployment
        const polyKeyHash = "0x4b09e658ed251bcafeebbc69400383d49f344ace09b9576fe248bb02c003fe9f";
        const polyVrfCoordinator = "0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed"
        const subScriptionId = 5715;
        Randomizer = await hre.ethers.getContractFactory("Randomizer");
        RandomizerContract = await Randomizer.deploy(polyKeyHash, polyVrfCoordinator, subScriptionId);
        await RandomizerContract.waitForDeployment();
    });

    describe("Test Suite", function () {
        it("Should set the right owner", async function () {
            const owner = await RandomizerContract.owner();
            expect(owner).to.be.equal(deployer.address);
        });

        it("random: should return the randomness numbers", async () => {
            const random = await RandomizerContract.random();
            expect(random).to.be.not.reverted;
        })
    });
});