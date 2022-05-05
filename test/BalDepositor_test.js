const { expect, use } = require("chai");
const { ethers, waffle } = require("hardhat");
// const { provider } = waffle;
const { BigNumber } = ethers;
const { Artifact } = require( "hardhat/types")
const { solidity } = require("ethereum-waffle");







use(solidity);
//staker will be our controller contract address
// Functions to test
// [x] SetFeeManager
// [x] SetFees
// [] initalLock
// [] _lockCurve (internal)
// [] deposit (public)
// [] deposit (external)
// [] depositAll

describe("BalDepositor", function(){
    let owner; // 0xf39
    let addr1; //staker
    let addr2; // minter
    let addr3; //vabl do we need this? in the CrvDepositor its just staker and minter in constructor
    let stakeAddress;
    let Depositor;
    // let ERC = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'
    let coinContractAddress;
    let coinContract;
    let voterContractAddress;
    let voterContract;
    let sample_token;
    let MockVbal;
    let MockRewards;

    let mockRewardsContractAddress;
    let mockRewardsContract;

    let MockD2DBal;

    let mockD2DBalContractAddress;
    let mockD2DBalContract;

    before(async () => {
        [owner, addr1, addr2, addr3, stakeAddress] = await ethers.getSigners();
        
        const SampleERC_Contract = await ethers.getContractFactory("SampleERC");
        sample_token = await SampleERC_Contract.deploy();
        await sample_token.deployed();
        console.log("this is token owner add;", owner.address)
        let balance = await sample_token.balanceOf(owner.address)

        console.log(balance.toString())

        const MockVoteProxy_Contract = await ethers.getContractFactory("VoterProxy");
        mockVoteProxy = await MockVoteProxy_Contract.deploy();
        await mockVoteProxy.deployed();
        console.log("voteProxy", await mockVoteProxy.owner())

        const MockVbalContract = await ethers.getContractFactory("MockVBAL");
        MockVbal = await MockVbalContract.deploy();
        await MockVbal.deployed();
        //console.log("Mockvbal", await MockVbal.owner())

        const MockRewardsContract = await ethers.getContractFactory("MockRewards");
        MockRewards = await MockRewardsContract.deploy();
        await MockRewards.deployed();

        const MockD2DBalContract = await ethers.getContractFactory("MockD2DBal");
        MockD2DBal = await MockD2DBalContract.deploy();
        await MockD2DBal.deployed();

        const BalDepositorContract = await ethers.getContractFactory("BalDepositor");
        Depositor = await BalDepositorContract.deploy(addr1.address, addr2.address,addr3.address);
        
        await Depositor.deployed();
        console.log("BAL Depositor Deployed Contract Address", Depositor.address)
        


        let tx = await Depositor.setCoinAddress("0x5FbDB2315678afecb367f032d93F642f64180aa3")
        tx.wait()
        coinContractAddress = await Depositor.coin()
        coinContract = await ethers.getContractAt("SampleERC", coinContractAddress);
        
        let tx2 = await Depositor.setVoterAddress("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512")
        tx2.wait()
        voterContractAddress = await Depositor.voter()
        voterContract = await ethers.getContractAt("VoterProxy", voterContractAddress);
        
        
        let tx3 = await Depositor.setMockVbalAddress("0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0")
        tx3.wait()
        mockVbalContractAddress = await Depositor.mockvBal()
        mockVbalContract = await ethers.getContractAt("MockVBAL", mockVbalContractAddress);
        
        let tx4 = await MockVbal.setCoinAddress("0x5FbDB2315678afecb367f032d93F642f64180aa3")
        tx4.wait()
        console.log("mockbvbal coin address", await MockVbal.coin())

        let tx7 = await MockRewards.setMockD2DBalAddress("0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9")
        tx7.wait()
        console.log("mockd2dbal in rewards contract", await MockRewards.mockD2DBal())

        let tx5 = await Depositor.setMockRewardsAddress("0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9")
        tx5.wait()
        mockRewardsContractAddress = await Depositor.mockRewards()
        mockRewardsContract = await ethers.getContractAt("MockRewards", mockRewardsContractAddress);
        
   
        let tx6 = await Depositor.setMockD2DBalAddress("0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9")
        tx6.wait()
        mockD2DBalContractAddress = await Depositor.mockD2DBal()
        mockD2DBalContract = await ethers.getContractAt("MockD2DBal", mockD2DBalContractAddress);
        // let Voterdepositor = await voterContract.owner();
       // console.log("owner", await voterContract.owner())

        //console.log(balanceOfBalDepositor.toString())
        
        
  
        // const MockERC20_Contract = await ethers.getContractFactory("ERC20Mock");
        // MockERC20 = await MockERC20_Contract.deploy();
        
        // await MockERC20.deployed();
       // console.log("owner", IERC20.approve())
    //    IERC20Address = await Depositor.mocktoken()
    //    //console.log(IERC20Address)
    //    IERC20_Contract = await ethers.getContractAt("ERC20Mock", IERC20Address);

        
    //    let owneroferc = await IERC20_Contract.owner()
          
    //    let ownerBal = await IERC20_Contract.balanceOf(Depositor.address);
       //let transferFrom
    //    console.log(owneroferc);

       
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

        it("Should allow feeManager to set a new lockIncentive ", async () => {
            let lockIncentiveInput  =  15;
            await Depositor.setFees(lockIncentiveInput);

            let new_lockIncentive =  await Depositor.lockIncentive();
            expect(new_lockIncentive).to.equal(lockIncentiveInput);
        });
        it("Should not update the lockIncentive if outside of the range ", async () => {
            let currentLockIncentive = await Depositor.lockIncentive();
            let lockIncentiveInput  =  45;
            await Depositor.setFees(lockIncentiveInput);

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
           let amount = 20
           let zeroString = String(0)
           console.log("voter contrsct owner",await voterContract.owner());

           let setVoterDepositor = await voterContract.setDepositor(Depositor.address)
           setVoterDepositor.wait()

           console.log("this is new depositor",await voterContract.depositor())
           await coinContract.connect(owner).approve(Depositor.address, amountApproved);
           await coinContract.connect(owner).increaseAllowance(mockVbalContract.address, amount);
                      
           let initialDeposit = await Depositor.connect(owner).deposit(amount)
           initialDeposit.wait()
           
           let updatedBalance = await coinContract.balanceOf(Depositor.address)
           console.log("Depositor bal", updatedBalance.toString())
            expect(updatedBalance.toString()).to.equal(zeroString);
            let updatedStakerBalance = await coinContract.balanceOf(addr1.address)
            // console.log("stake bal", updatedStakerBalance.toString())
            // expect(updatedStakerBalance.toString()).to.equal(amount.toString());
            let updatedVbalContractBalance = await coinContract.balanceOf(MockVbal.address)
            console.log("vbal bal", updatedVbalContractBalance.toString())
            expect(updatedVbalContractBalance.toString()).to.equal(amount.toString());
            let depositorD2DBalance = await mockD2DBalContract.balanceOf(Depositor.address)
            console.log("Baldepositor should haved2dtoken", depositorD2DBalance.toString())
         // expect(depositorD2DBalance.toString()).to.equal(amount.toString());

         //  let mockRewardsD2DBal = await mockD2DBalContract.balanceOf(mockRewardsContract.address)
         //  console.log("mockRewards should haved2dtoken", mockRewardsD2DBal.toString())
            
        });

    })

});



// flow:
// approve funds is for vbal 
// call depsoit for in vbal contract, inaside deposit for we provide address of voter proxy
// deposit contract is minting d2dBal tokens and stake rewards contract
// last part is stake funn amount into rewards contract

   
