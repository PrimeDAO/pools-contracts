const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');
const { expect } = require('chai');
const { deployments, ethers } = require('hardhat');
const init = require('../test-init.js');
const { ONE_ADDRESS, ONE_HUNDRED_ETHER } = require('../helpers/constants');
const { getFutureTimestamp, getCurrentBlockTimestamp } = require('../helpers/helpers');

describe('unit - VoterProxy', function () {
  let voterProxy,
    mintr,
    operator,
    gauge,
    distro,
    gaugeController,
    externalContract,
    root,
    bal,
    veBal,
    wethBal,
    B50WBTC50WETH,
    anotherUser,
    stash;

  const setupTests = deployments.createFixture(async () => {
    const signers = await ethers.getSigners();
    const setup = await init.initialize(signers);
    await init.getTokens(setup);
    const gaugeControllerMock = await init.gaugeController(setup);
    const mintr = await init.getMintrMock(setup);
    const voterProxy = await init.getVoterProxy(setup, gaugeControllerMock, mintr);
    const controllerMock = await init.getControllerMock(setup);
    const distroMock = await init.getDistroMock(setup);
    const externalContractMock = await init.getExternalContractMock(setup);
    const B50WBTC50WETH = setup.tokens.B50WBTC50WETH;
    const gaugeMock = await init.getGaugeMock(setup, B50WBTC50WETH.address);
    await setup.tokens.WethBal.mint(voterProxy.address, ONE_HUNDRED_ETHER.mul(5));
    const smartWalletChecker = await init.getSmartWalletCheckerMock(setup);
    await setup.tokens.VeBal.connect(setup.roles.authorizer_adaptor).commit_smart_wallet_checker(
      smartWalletChecker.address
    );
    await setup.tokens.VeBal.connect(setup.roles.authorizer_adaptor).apply_smart_wallet_checker();
    await smartWalletChecker.allow(voterProxy.address);
    await gaugeControllerMock.add_type('Ethereum', 0);
    await gaugeControllerMock.add_gauge(gaugeMock.address, 0, 0);

    return {
      voterProxy,
      mintr,
      operator: controllerMock,
      gauge: gaugeMock,
      distro: distroMock,
      gaugeController: gaugeControllerMock,
      externalContract: externalContractMock,
      root: setup.roles.root,
      bal: setup.tokens.BAL,
      veBal: setup.tokens.VeBal,
      wethBal: setup.tokens.WethBal,
      B50WBTC50WETH, // LP token
      anotherUser: signers.pop(),
      stash: signers.pop(),
    };
  });

  beforeEach(async function () {
    const setup = await setupTests();

    voterProxy = setup.voterProxy;
    mintr = setup.mintr;
    operator = setup.operator;
    gauge = setup.gauge;
    distro = setup.distro;
    gaugeController = setup.gaugeController;
    externalContract = setup.externalContract;
    root = setup.root;
    bal = setup.bal;
    veBal = setup.veBal;
    wethBal = setup.wethBal;
    B50WBTC50WETH = setup.B50WBTC50WETH;
    anotherUser = setup.anotherUser;
    stash = setup.stash;
  });

  context('setup', async function () {
    it('should setup', async function () {
      expect(await voterProxy.mintr()).to.equals(mintr.address);
      expect(await voterProxy.bal()).to.equals(bal.address);
      expect(await voterProxy.wethBal()).to.equals(wethBal.address);
      expect(await voterProxy.veBal()).to.equals(veBal.address);
      expect(await voterProxy.gaugeController()).to.equals(gaugeController.address);
      expect(await voterProxy.owner()).to.equals(root.address);
      expect(await voterProxy.operator()).to.equals(ZERO_ADDRESS);
      expect(await voterProxy.depositor()).to.equals(ZERO_ADDRESS);
    });
  });

  it('reverts if not owner', async function () {
    await expect(voterProxy.connect(anotherUser).setOperator(ZERO_ADDRESS)).to.be.revertedWith('Unauthorized()');
  });

  it('reverts if not depositor', async function () {
    await expect(
      voterProxy.connect(anotherUser).createLock(ONE_HUNDRED_ETHER, await getFutureTimestamp(365))
    ).to.be.revertedWith('Unauthorized()');
  });

  it('reverts if no stash access', async function () {
    await expect(voterProxy.connect(anotherUser)['withdraw(address)'](B50WBTC50WETH.address)).to.be.revertedWith(
      'Unauthorized()'
    );
  });

  it('should revert if not authorized', async function () {
    await expect(voterProxy.connect(anotherUser).setOwner(ZERO_ADDRESS)).to.be.revertedWith('Unauthorized()');
  });

  context('Owner', async function () {
    it('should set owner', async function () {
      await expect(voterProxy.connect(root).setOwner(anotherUser.address))
        .to.emit(voterProxy, 'OwnerChanged')
        .withArgs(anotherUser.address);
    });
  });

  context('Operator', async function () {
    it('sets the operator', async function () {
      await expect(voterProxy.connect(root).setOperator(anotherUser.address))
        .to.emit(voterProxy, 'OperatorChanged')
        .withArgs(anotherUser.address);
    });

    it('sets the operator to zero address', async function () {
      await expect(voterProxy.setOperator(ZERO_ADDRESS)).to.emit(voterProxy, 'OperatorChanged').withArgs(ZERO_ADDRESS);
    });

    it('reverts if the operator is not shutdown', async function () {
      // operator is zero address, so we can set it to operator mock
      await expect(voterProxy.setOperator(operator.address))
        .to.emit(voterProxy, 'OperatorChanged')
        .withArgs(operator.address);
      // operator is not zero address, isShutdown() in mock is false
      // so it reverts
      await expect(voterProxy.setOperator(ONE_ADDRESS)).to.be.revertedWith('NeedsShutdown()');
    });
  });

  it('sets depositor', async function () {
    await expect(voterProxy.setDepositor(anotherUser.address))
      .to.emit(voterProxy, 'DepositorChanged')
      .withArgs(anotherUser.address);
  });

  it('grants stash access', async function () {
    await changeOperator(voterProxy, anotherUser.address);
    await voterProxy.connect(anotherUser).grantStashAccess(stash.address);
  });

  it('deposits lp tokens', async function () {
    // We're depositing B50WBTC50WETH LP tokens to voter proxy, and it is interacting with gauge mock
    await changeOperator(voterProxy, anotherUser.address);
    // mint 100 B50WBTC50WETH to voterProxy
    await B50WBTC50WETH.mint(voterProxy.address, ONE_HUNDRED_ETHER);
    expect(await B50WBTC50WETH.balanceOf(voterProxy.address)).to.equals(ONE_HUNDRED_ETHER);
    // deposit LP token to voterProxy
    // voter calls deposit on gaugeMock
    // gauge mock jsut taransfers that balance to itself
    await voterProxy.connect(anotherUser).deposit(B50WBTC50WETH.address, gauge.address);
    // make sure that gaugeMock got the tokens
    expect(await B50WBTC50WETH.balanceOf(gauge.address)).to.equals(ONE_HUNDRED_ETHER);
  });

  context('Withdraw', async function () {
    context('withdraww(address)', async function () {
      it('withdraws unprotected asset using withdraww(address)', async function () {
        // unprotected asset is token that is not deposited to VoterProxy via .deposit

        // mint 100 B50WBTC50WETH
        await B50WBTC50WETH.mint(voterProxy.address, ONE_HUNDRED_ETHER);

        await changeOperator(voterProxy, anotherUser.address);
        // give access to self
        await voterProxy.connect(anotherUser).grantStashAccess(anotherUser.address);

        expect(await B50WBTC50WETH.balanceOf(voterProxy.address)).to.equals(ONE_HUNDRED_ETHER);
        await voterProxy.connect(anotherUser)['withdraw(address)'](B50WBTC50WETH.address);
        expect(await B50WBTC50WETH.balanceOf(anotherUser.address)).to.equals(ONE_HUNDRED_ETHER);
      });

      it("doesn't withdraw protected asset", async function () {
        await changeOperator(voterProxy, anotherUser.address);
        // give access to self
        await voterProxy.connect(anotherUser).grantStashAccess(anotherUser.address);

        await B50WBTC50WETH.mint(voterProxy.address, ONE_HUNDRED_ETHER);
        expect(await B50WBTC50WETH.balanceOf(voterProxy.address)).to.equals(ONE_HUNDRED_ETHER);

        await voterProxy.connect(anotherUser).deposit(B50WBTC50WETH.address, gauge.address);

        await voterProxy.connect(anotherUser)['withdraw(address)'](B50WBTC50WETH.address);
        // gauge should have the same amount of tokens
        expect(await B50WBTC50WETH.balanceOf(gauge.address)).to.equals(ONE_HUNDRED_ETHER);
      });
    });

    context('withdraw(address,address,uint256)', async function () {
      it('withdraws amount', async function () {
        await changeOperator(voterProxy, anotherUser.address);
        // mint token to proxy and gauge
        await B50WBTC50WETH.mint(voterProxy.address, ONE_HUNDRED_ETHER);
        await B50WBTC50WETH.mint(gauge.address, ONE_HUNDRED_ETHER);
        // check balance before withdrawal
        expect(await B50WBTC50WETH.balanceOf(voterProxy.address)).to.equals(ONE_HUNDRED_ETHER);
        const fiftyEther = ethers.utils.parseEther('50');
        const oneHundredFiftyEther = ONE_HUNDRED_ETHER.add(fiftyEther);
        // Withdraw 100 ethers from voterProxy and 50 from gauge
        expect(
          await voterProxy
            .connect(anotherUser)
            ['withdraw(address,address,uint256)'](B50WBTC50WETH.address, gauge.address, oneHundredFiftyEther)
        );
        // validate balances after withdrawal
        expect(await B50WBTC50WETH.balanceOf(voterProxy.address)).to.equals(0);
        expect(await B50WBTC50WETH.balanceOf(gauge.address)).to.equals(fiftyEther);
      });
    });

    context('withdrawAll(address,address)', async function () {
      it('withdraws all', async function () {
        await changeOperator(voterProxy, anotherUser.address);
        // mint token to proxy and gauge
        await B50WBTC50WETH.mint(voterProxy.address, ONE_HUNDRED_ETHER);
        await B50WBTC50WETH.mint(gauge.address, ONE_HUNDRED_ETHER);
        await voterProxy.connect(anotherUser)['withdrawAll(address,address)'](B50WBTC50WETH.address, gauge.address);
        expect(await B50WBTC50WETH.balanceOf(anotherUser.address)).to.equals(ONE_HUNDRED_ETHER.mul(2)); // 200 ether
      });
    });
  });

  it('creates a lock', async function () {
    await voterProxy.setDepositor(anotherUser.address);
    await voterProxy.connect(anotherUser).createLock(ONE_HUNDRED_ETHER, await getFutureTimestamp(365));
  });

  it('increases amount', async function () {
    await voterProxy.setDepositor(anotherUser.address);
    await voterProxy.connect(anotherUser).createLock(ONE_HUNDRED_ETHER, await getFutureTimestamp(365));
    await voterProxy.connect(anotherUser).increaseAmount(1);
  });

  it('increases time', async function () {
    await voterProxy.setDepositor(anotherUser.address);
    // lock for 100 days
    await voterProxy.connect(anotherUser).createLock(ONE_HUNDRED_ETHER, await getFutureTimestamp(100));
    // increase lock to 200 days
    const nextUnlock = await getFutureTimestamp(200);
    await voterProxy.connect(anotherUser).increaseTime(nextUnlock);
  });

  it('increases time', async function () {
    await voterProxy.setDepositor(anotherUser.address);
    await voterProxy.connect(anotherUser).release();
  });

  it('reverts if bad input on voteMultipleGauges', async function () {
    await changeOperator(voterProxy, anotherUser.address);
    await expect(voterProxy.connect(anotherUser).voteMultipleGauges([ZERO_ADDRESS], [1, 1])).to.be.revertedWith(
      'BadInput()'
    );
  });

  it('votes on voteMultipleGauges', async function () {
    await changeOperator(voterProxy, anotherUser.address);
    await voterProxy.setDepositor(anotherUser.address);

    await voterProxy.connect(anotherUser).createLock(ONE_HUNDRED_ETHER, await getFutureTimestamp(100));

    const currentTimeInSeconds = await getCurrentBlockTimestamp();

    // manipulate future timestamp
    const nextBlockTimestamp = currentTimeInSeconds + 1000; // current timestamp + 1000 seconds
    await network.provider.send('evm_setNextBlockTimestamp', [nextBlockTimestamp]);

    const weight = 500;

    await expect(voterProxy.connect(anotherUser).voteMultipleGauges([gauge.address], [weight]))
      .to.emit(gaugeController, 'VoteForGauge')
      .withArgs(nextBlockTimestamp, voterProxy.address, gauge.address, weight);
  });

  it('claims bal', async function () {
    await changeOperator(voterProxy, anotherUser.address);
    expect(await bal.balanceOf(anotherUser.address)).to.equals(0);
    // Mintr mock doesn't care about zero address
    await voterProxy.connect(anotherUser).claimBal(ZERO_ADDRESS);
    // mintr mock mints 100 bal
    expect(await bal.balanceOf(anotherUser.address)).to.equals(ONE_HUNDRED_ETHER);
  });

  it('claims rewards', async function () {
    await changeOperator(voterProxy, anotherUser.address);
    // gauge mock doesn't throw
    await voterProxy.connect(anotherUser).claimRewards(gauge.address);
  });

  it('claims fees', async function () {
    await changeOperator(voterProxy, anotherUser.address);
    await bal.mint(voterProxy.address, ONE_HUNDRED_ETHER);
    expect(await bal.balanceOf(voterProxy.address)).to.equals(ONE_HUNDRED_ETHER);
    // distro mock does nothing
    await voterProxy.connect(anotherUser).claimFees(distro.address, bal.address);
    expect(await bal.balanceOf(voterProxy.address)).to.equals(0);
    expect(await bal.balanceOf(anotherUser.address)).to.equals(ONE_HUNDRED_ETHER);
  });

  it('executes calldata with value', async function () {
    await changeOperator(voterProxy, anotherUser.address);
    const number = 1337;
    const factory = await ethers.getContractFactory('ExternalContractMock');
    const tx = factory.interface.encodeFunctionData('works', [number]);
    await expect(voterProxy.connect(anotherUser).execute(externalContract.address, 0, tx))
      .to.emit(externalContract, 'Yay')
      .withArgs(number);
  });
});

const changeOperator = async function (voterProxy, operator) {
  await expect(voterProxy.setOperator(operator)).to.emit(voterProxy, 'OperatorChanged').withArgs(operator);
};
