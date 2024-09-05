const { expect } = require("chai");
const { ethers } = require("ethers");
const hre = require("hardhat")

describe.skip("ANTCoin", function () {
    let ANTCoin, ANTCoinContract;

    beforeEach(async function () {
        [deployer, controller, badActor, user1, user2, user3, ...user] = await hre.ethers.getSigners();

        // ANTCoin smart contract deployment
        ANTCoin = await hre.ethers.getContractFactory("ANTCoin");
        ANTCoinContract = await hre.upgrades.deployProxy(ANTCoin, [ethers.parseEther("200000000"), "0x0000000000000000000000000000000000000000", "0x000000000000000000000000000000000000dEaD"], {
            initializer: "initialize",
            kind: "transparent",
        });
        await ANTCoinContract.waitForDeployment();
    });

    describe("Test Suite", function () {
        it("Should set the right owner", async function () {
            const owner = await ANTCoinContract.owner();
            expect(owner).to.be.equal(deployer.address);
        });

        it("addMinterRole: should fail if caller is not owner", async () => {
            await expect(ANTCoinContract.connect(user1).addMinterRole(user2.address)).to.be.revertedWith("Ownable: caller is not the owner")
        })

        it("addMinterRole: should work if caller is owner", async () => {
            await ANTCoinContract.addMinterRole(user1.address);
            const role = await ANTCoinContract.getMinterRole(user1.address);
            expect(role).to.be.equal(true);
        })

        it("revokeMinterRole: should fail if caller is not owner", async () => {
            await expect(ANTCoinContract.connect(badActor).revokeMinterRole(user2.address)).to.be.revertedWith("Ownable: caller is not the owner");
        })

        it("revokeMinterRole: should work if caller is owner", async () => {
            await ANTCoinContract.addMinterRole(user1.address);
            const role1 = await ANTCoinContract.getMinterRole(user1.address);
            expect(role1).to.be.equal(true);
            await ANTCoinContract.revokeMinterRole(user1.address);
            const role2 = await ANTCoinContract.getMinterRole(user1.address);
            expect(role2).to.be.equal(false);
        })

        it("mint: should fail if caller is not minter", async () => {
            await expect(ANTCoinContract.connect(badActor).mint(user1.address, 10000)).to.be.revertedWith("ANTCoin: Caller is not the owner or minter");
        })

        it("mint: should fail if mint amount exceed the max circulation supply", async () => {
            const maxCirculationSupply = await ANTCoinContract.maxCirculationSupply();
            await expect(ANTCoinContract.mint(user1.address, BigInt(maxCirculationSupply) + BigInt(1))).to.be.revertedWith("ANTCoin: Mint amount exceed Max Circulation Supply");
        })

        it("mint: should work if caller is minter", async () => {
            await ANTCoinContract.mint(user1.address, 1000000);
            const expected = await ANTCoinContract.balanceOf(user1.address);
            expect(Number(expected)).to.be.equal(1000000);
        })

        it("burn: should fail if caller is not minter", async () => {
            await expect(ANTCoinContract.connect(badActor).burn(user1.address, 10000)).to.be.revertedWith("ANTCoin: Caller is not the owner or minter");
        })

        it("burn: burn function should work", async () => {
            const mintAmount = 1000000;
            await ANTCoinContract.addMinterRole(user3.address);
            await ANTCoinContract.mint(user1.address, mintAmount);
            const balance1 = await ANTCoinContract.balanceOf(user1.address);
            expect(balance1).to.be.equal(mintAmount);
            await ANTCoinContract.connect(user3).burn(user1.address, mintAmount);
            const balance2 = await ANTCoinContract.balanceOf(user1.address);
            expect(balance2).to.be.equal(0);
        })

        // need to have a test on deployed mumbai test network
        it.skip("currentCirculationSupply: should be calculated correctly if minter mint or burn ANTCoint tokens", async () => {
            const mintAmount = BigNumber.from("100000000");
            const initialMintAmount = BigNumber.from("100000000000000000000000000"); // 100 million
            const maxCirculationSupply = await ANTCoinContract.maxCirculationSupply();
            await ANTCoinContract.addMinterRole(user1.address);
            const currentCirculationSupply1 = await ANTCoinContract.currentCirculationSupply();
            expect(currentCirculationSupply1).to.be.equal(initialMintAmount);
            await ANTCoinContract.connect(user1).mint(user2.address, mintAmount);
            const currentCirculationSupply2 = await ANTCoinContract.currentCirculationSupply();
            expect(currentCirculationSupply2).to.be.equal(initialMintAmount.add(mintAmount));
            await ANTCoinContract.connect(user1).mint(user2.address, mintAmount);
            const currentCirculationSupply3 = await ANTCoinContract.currentCirculationSupply();
            expect(currentCirculationSupply3).to.be.equal(initialMintAmount.add(mintAmount.mul(2)));
            await expect(ANTCoinContract.connect(user1).mint(user2.address, maxCirculationSupply.sub(initialMintAmount.add(mintAmount.mul(2))))).to.be.not.reverted;
            await expect(ANTCoinContract.connect(user1).mint(user2.address, 1)).to.be.revertedWith("ANTCoin: Mint amount exceed Max Circulation Supply");
            await ANTCoinContract.connect(user1).burn(user2.address, mintAmount.mul(2));
            await expect(ANTCoinContract.connect(user1).mint(user2.address, mintAmount)).to.be.not.reverted;
            await expect(ANTCoinContract.connect(user1).mint(user2.address, mintAmount)).to.be.not.reverted;
            await expect(ANTCoinContract.connect(user1).mint(user2.address, mintAmount)).to.be.revertedWith("ANTCoin: Mint amount exceed Max Circulation Supply");
        })

        it("setPaused: should fail if caller is not the owner", async () => {
            await expect(ANTCoinContract.connect(user1).setPaused(true)).to.be.revertedWith("Ownable: caller is not the owner")
        })

        it("setPaused: if paused, all transfer, mint and burn functions should be passed", async () => {
            await ANTCoinContract.setPaused(true);
            await expect(ANTCoinContract.mint(user1.address, 1000000)).to.be.revertedWith("Pausable: paused");
            await expect(ANTCoinContract.burn(user1.address, 1000000)).to.be.revertedWith("Pausable: paused");
            await expect(ANTCoinContract.transferFrom(deployer.address, user1.address, 1000000)).to.be.revertedWith("Pausable: paused");
            await expect(ANTCoinContract.transfer(user1.address, 1000000)).to.be.revertedWith("Pausable: paused");
            await ANTCoinContract.setPaused(false);
            await expect(ANTCoinContract.mint(user1.address, 1000000)).to.be.not.reverted;
            await expect(ANTCoinContract.burn(user1.address, 1000000)).to.be.not.reverted;
            const ownerBalance = await ANTCoinContract.balanceOf(deployer.address);
            await ANTCoinContract.approve(user1.address, 10000);
            await ANTCoinContract.connect(user1).transferFrom(deployer.address, user1.address, 10000);
            const expectedBalance1 = await ANTCoinContract.balanceOf(user1.address);
            expect(expectedBalance1).to.be.equal(10000);
            await expect(ANTCoinContract.transfer(user2.address, 10000)).to.be.not.reverted;
            const expectedBalance2 = await ANTCoinContract.balanceOf(user2.address);
            expect(expectedBalance2).to.be.equal(10000);
        })
    });
});