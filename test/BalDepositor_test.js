const { expect, use } = require("chai");
const { ethers, waffle } = require("hardhat");
const { BigNumber } = ethers;
const { Artifact } = require( "hardhat/types")
const { solidity } = require("ethereum-waffle");


use(solidity);
//staker will be our controller contract address
// Functions to test
// [x] SetFeeManager
// [x] SetFees
// [] initalLock

// [x] deposit (public)
// [x] deposit (external)
// [x] depositAll

describe("BalDepositor", function(){
    let owner; 
    let addr1; //staker
    let addr2; // minter
    let addr3; 
    let stakeAddress;
    let Depositor;

    let coinContractAddress;
    let coinContract;
    let voterContractAddress;
    let voterContract;
    let sample_token;
    let MockVbal;
    let MockRewards;
    let mockRewardsContractAddress;
    let MockD2DBal;
    let mockD2DBalContractAddress;

    let mockVoteProxy;
    let deposit_amount_one;
    let deposit_amount_two;
    let OwnerBalTokenbalance;

    before(async () => {
        [owner, addr1, addr2, addr3, stakeAddress] = await ethers.getSigners();
        
        //Deploy mock weth/bal erc20

        const SampleERC_Contract = await ethers.getContractFactory("SampleERC");
        sample_token = await SampleERC_Contract.deploy();
        await sample_token.deployed();

        //Orignial token balance - will remove with live contracts
        OwnerBalTokenbalance = await sample_token.balanceOf(owner.address)


        //Deploy mock VoterProxy contract address
        const MockVoteProxy_Contract = await ethers.getContractFactory("VoterProxy");
        mockVoteProxy = await MockVoteProxy_Contract.deploy();
        await mockVoteProxy.deployed();

        //set weth/bal erc20 address on VoterProxy contract address
        await mockVoteProxy.setCoinAddress(sample_token.address)

        //Deploy mock veBal contract 
        const MockVbalContract = await ethers.getContractFactory("MockVBAL");
        MockVbal = await MockVbalContract.deploy();
        await MockVbal.deployed();

        //set veBal address on VoterProxy contract 
        await mockVoteProxy.setMockVbalAddress(MockVbal.address)

        //Deploy mock rewards contract 
        const MockRewardsContract = await ethers.getContractFactory("MockRewards");
        MockRewards = await MockRewardsContract.deploy();
        await MockRewards.deployed();

        //Deploy mock d2dBal contract 
        const MockD2DBalContract = await ethers.getContractFactory("MockD2DBal");
        MockD2DBal = await MockD2DBalContract.deploy();
        await MockD2DBal.deployed();

        //Deploy BalDepositor contract 
        const BalDepositorContract = await ethers.getContractFactory("BalDepositor");
        Depositor = await BalDepositorContract.deploy(addr1.address, addr2.address,addr3.address);
        
        await Depositor.deployed();

        
        /// @notice Set the addresses on the depositor contract. Need deployed addresses
        //set weth/bal address on Depositor contract 
        await Depositor.setCoinAddress(sample_token.address)
        coinContractAddress = await Depositor.coin()
        coinContract = await ethers.getContractAt("SampleERC", coinContractAddress);
        
        //set voterProxy address on Depositor contract 
        await Depositor.setVoterAddress(mockVoteProxy.address)
        voterContractAddress = await Depositor.voter()
        voterContract = await ethers.getContractAt("VoterProxy", voterContractAddress);
        
        //set veBal address on Depositor contract 
        await Depositor.setMockVbalAddress(MockVbal.address)
        mockVbalContractAddress = await Depositor.mockvBal()
        mockVbalContract = await ethers.getContractAt("MockVBAL", mockVbalContractAddress);

        //set weth/bal address on veBal contract 
        await MockVbal.setCoinAddress(sample_token.address)
        
        //set d2dBal address on Rewards contract 
        await MockRewards.setMockD2DBalAddress(MockD2DBal.address)

        //set rewards address on Depositor contract 
        await Depositor.setMockRewardsAddress(MockRewards.address)
        mockRewardsContractAddress = await Depositor.mockRewards()
        mockRewardsContract = await ethers.getContractAt("MockRewards", mockRewardsContractAddress);
        
        //set d2dBal address on Depositor contract 
        await Depositor.setMockD2DBalAddress(MockD2DBal.address)

        mockD2DBalContractAddress = await Depositor.mockD2DBal()
        mockD2DBalContract = await ethers.getContractAt("MockD2DBal", mockD2DBalContractAddress);

        //set rewards address on VoterProxy contract 
        await mockVoteProxy.setMockRewardsAddress(MockRewards.address)
        
    })

    describe("Testing setFeeManager function", () => {
        it("Should fail if setFeeManager caller is not the fee m/anager ", async () => {
            let tx = Depositor.connect(addr1).setFeeManager(addr1.address);
            await expect(tx).to.be.revertedWith("!auth");
        });
        it("Should allow feeManager to set a new FeeManager ", async () => {
            await Depositor.setFeeManager(addr1.address);
            let CurrentFeeManager =  await Depositor.feeManager();
            expect(CurrentFeeManager).to.equal(addr1.address);
        });

    })
    describe("Testing setFees function", () => {
        beforeEach(async () => {
            await Depositor.connect(addr1).setFeeManager(addr1.address);
        });
        it("Should allow feeManager to set a new lockIncentive ", async () => {
            let lockIncentiveInput  =  15;
            await Depositor.connect(addr1).setFees(lockIncentiveInput);

            let new_lockIncentive =  await Depositor.lockIncentive();
            expect(new_lockIncentive).to.equal(lockIncentiveInput);
        });
        it("Should not update the lockIncentive if outside of the range ", async () => {
            let currentLockIncentive = await Depositor.lockIncentive();
            let lockIncentiveInput  =  45;
            await Depositor.connect(addr1).setFees(lockIncentiveInput);

            let new_lockIncentive =  await Depositor.lockIncentive();
            expect(new_lockIncentive).to.equal(currentLockIncentive);
        });

    })


    describe("Testing deposit function", () => {

        it("Should fail if deposit amount is not sufficient", async () => {
            let amount = ethers.utils.parseEther('0')
            await expect(
                Depositor.deposit(amount)
            ).to.be.revertedWith('!>0');
        });

        it("Should transfer tokens from sender to the Depositor contract, and defer lock cost to another user", async () => {
           let amountApproved = 200;
           deposit_amount_one = 20

           let setVoterDepositor = await voterContract.setDepositor(Depositor.address)
           setVoterDepositor.wait()

           await coinContract.connect(owner).approve(Depositor.address, amountApproved);
           await coinContract.connect(owner).increaseAllowance(mockVbalContract.address, deposit_amount_one);
            
           await Depositor.connect(owner).deposit(deposit_amount_one)

           let vBal_contract_WethBalBalance = await coinContract.balanceOf(MockVbal.address)
           let rewards_Contract_d2dBalance = await MockD2DBal.balanceOf(MockRewards.address)
 
            expect(vBal_contract_WethBalBalance.toString()).to.equal(deposit_amount_one.toString());
            expect(rewards_Contract_d2dBalance.toString()).to.equal(deposit_amount_one.toString());
        });

    })
    describe("Testing _deposit function", () => {

        it("Should test _deposit function", async () => {
            deposit_amount_two = 45
            let  updatedBalance = deposit_amount_one + deposit_amount_two;
             
            await Depositor.connect(owner)._deposit(deposit_amount_two)
 
            let vBal_contract_WethBalBalance = await coinContract.balanceOf(MockVbal.address)
            let rewards_Contract_d2dBalance = await MockD2DBal.balanceOf(MockRewards.address)

            expect(vBal_contract_WethBalBalance.toString()).to.equal(updatedBalance.toString());
            expect(rewards_Contract_d2dBalance.toString()).to.equal(updatedBalance.toString());
         });

    })
    describe("Testing depositAll function", () => {

        it("Should test depositAll function", async () => {

            let OwnerBalance = await coinContract.balanceOf(owner.address)

            await coinContract.connect(owner).approve(Depositor.address, OwnerBalance);
            await coinContract.connect(owner).increaseAllowance(mockVbalContract.address, OwnerBalance);
            
            await Depositor.connect(owner).depositAll()
 
            let vBal_contract_WethBalBalance = await coinContract.balanceOf(MockVbal.address)

            expect(vBal_contract_WethBalBalance.toString()).to.equal(OwnerBalTokenbalance.toString());

         });

    })
    // describe("Testing initalLock function", () => {

    //     it("Should test initalLock function", async () => {

    //      });
    // })
    // describe("Testing external lock function", () => {

    //     it("Should test lock function", async () => {

    //      });
    // })

});



   
