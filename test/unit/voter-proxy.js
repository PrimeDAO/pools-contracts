const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const { expect } = require("chai");
const { deployments, ethers } = require("hardhat");
const init = require("../test-init.js");
const { ONE_ADDRESS, ONE_HUNDRED_ETHER } = require('../helpers/constants');
const { getFutureTimestamp } = require('../helpers/helpers')

describe("VoterProxy", function () {
    const setupTests = deployments.createFixture(async () => {
        const signers = await ethers.getSigners();
        const setup = await init.initialize(signers);
        await init.getTokens(setup);

        const gaugeControllerMock = await init.gaugeControllerMock(setup);
        const mintr = await init.getMintrMock(setup);
        const voterProxy = await init.getVoterProxy(setup, gaugeControllerMock, mintr);
        const controllerMock = await init.getControllerMock(setup)
        const distroMock = await init.getDistroMock(setup);
        const externalContractMock = await init.getExternalContractMock(setup);

        const B50WBTC50WETH = setup.tokens.B50WBTC50WETH;
        const gaugeMock = await init.getGaugeMock(setup, B50WBTC50WETH.address);

        await setup.tokens.WethBal.mint(voterProxy.address, ONE_HUNDRED_ETHER.mul(5));

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
            votingMock: await init.getVotingMock(setup),
            B50WBTC50WETH, // LP token
            anotherUser: signers.pop(),
            stash: signers.pop()
        }
    });

    context('setup', async function () {
        it('should setup', async function () {
            const { voterProxy, bal, wethBal, gaugeController, root, veBal, mintr } = await setupTests();

            expect(await voterProxy.mintr()).to.equals(mintr.address)
            expect(await voterProxy.bal()).to.equals(bal.address)
            expect(await voterProxy.wethBal()).to.equals(wethBal.address)
            expect(await voterProxy.veBal()).to.equals(veBal.address)
            expect(await voterProxy.gaugeController()).to.equals(gaugeController.address)
            expect(await voterProxy.owner()).to.equals(root.address)
            expect(await voterProxy.operator()).to.equals(ZERO_ADDRESS)
            expect(await voterProxy.depositor()).to.equals(ZERO_ADDRESS)
        });
    });

    context('Owner', async function () {
        it('should set owner', async function () {
            const { voterProxy, anotherUser, root } = await setupTests();
            await expect(voterProxy.connect(root).setOwner(anotherUser.address))
                .to.emit(voterProxy, 'OwnerChanged')
                .withArgs(anotherUser.address);
        });

        it('should revert if not authorized', async function () {
            const { voterProxy, anotherUser } = await setupTests();
            await expect(voterProxy.connect(anotherUser).setOwner(ZERO_ADDRESS))
                .to.be.revertedWith('Unauthorized()')
        });
    });

    context('Operator', async function () {
        it('sets the operator', async function () {
            const { voterProxy, anotherUser, root } = await setupTests();
            await expect(voterProxy.connect(root).setOperator(anotherUser.address))
                .to.emit(voterProxy, 'OperatorChanged')
                .withArgs(anotherUser.address);
        });

        it('sets the operator to zero address', async function () {
            const { voterProxy } = await setupTests();
            await expect(voterProxy.setOperator(ZERO_ADDRESS))
                .to.emit(voterProxy, 'OperatorChanged')
                .withArgs(ZERO_ADDRESS);
        });

        it('reverts if unauthorized', async function () {
            const { voterProxy, anotherUser } = await setupTests();
            await expect(voterProxy.connect(anotherUser).setOperator(ZERO_ADDRESS))
                .to.be.revertedWith('Unauthorized()')
        });

        it('reverts if the operator is not shutdown', async function () {
            const { voterProxy, operator } = await setupTests();

            // operator is zero address, so we can set it to operator mock
            await expect(voterProxy.setOperator(operator.address))
                .to.emit(voterProxy, 'OperatorChanged')
                .withArgs(operator.address);

            // operator is not zero address, isShutdown() in mock is false
            // so it reverts
            await expect(voterProxy.setOperator(ONE_ADDRESS))
                .to.be.revertedWith('NeedsShutdown()')
        });
    });

    context('Depositor', async function () {
        it('sets depositor', async function () {
            const { voterProxy, anotherUser } = await setupTests();

            await expect(voterProxy.setDepositor(anotherUser.address))
                .to.emit(voterProxy, 'DepositorChanged')
                .withArgs(anotherUser.address);
        });
    });

    context('Stash access', async function () {
        it('sets stash access', async function () {
            // use random wallet as 'operator'
            const { voterProxy, anotherUser: operator, stash } = await setupTests();

            await changeOperator(voterProxy, operator.address);

            await voterProxy.connect(operator).setStashAccess(stash.address, true)
        });

        it('reverts if unauthorized', async function () {
            const { voterProxy, anotherUser } = await setupTests();

            await expect(voterProxy.setStashAccess(anotherUser.address, true))
                .to.be.revertedWith('Unauthorized()');
        });
    });

    context('Deposit', async function () {
        it('reverts if unauthorized', async function () {
            const { voterProxy } = await setupTests();

            await expect(voterProxy.deposit(ONE_ADDRESS, ZERO_ADDRESS))
                .to.be.revertedWith('Unauthorized()')
        });

        it('deposits lp tokens', async function () {
            // We're depositing B50WBTC50WETH LP tokens to voter proxy, and it is interacting with gauge mock
            const { voterProxy, anotherUser: operator, B50WBTC50WETH, gauge } = await setupTests();

            await changeOperator(voterProxy, operator.address);

            // mint 100 B50WBTC50WETH to voterProxy
            await B50WBTC50WETH.mint(voterProxy.address, ONE_HUNDRED_ETHER)
            expect(await B50WBTC50WETH.balanceOf(voterProxy.address)).to.equals(ONE_HUNDRED_ETHER)

            // deposit LP token to voterProxy
            // voter calls deposit on gaugeMock
            // gauge mock jsut taransfers that balance to itself
            await voterProxy.connect(operator).deposit(B50WBTC50WETH.address, gauge.address)
            // make sure that gaugeMock got the tokens
            expect(await B50WBTC50WETH.balanceOf(gauge.address)).to.equals(ONE_HUNDRED_ETHER)
        });
    });

    context('Withdraw', async function () {

        context('withdraww(address)', async function () {
            it('reverts if unauthorized', async function () {
                const { voterProxy } = await setupTests();

                await expect(voterProxy['withdraw(address)'](ONE_ADDRESS))
                    .to.be.revertedWith('Unauthorized()')
            });

            it('withdraws unprotected asset using withdraww(address)', async function () {
                const { voterProxy, anotherUser: operator, B50WBTC50WETH } = await setupTests();

                // unprotected asset is token that is not deposited to VoterProxy via .deposit

                // mint 100 B50WBTC50WETH
                await B50WBTC50WETH.mint(voterProxy.address, ONE_HUNDRED_ETHER);

                await changeOperator(voterProxy, operator.address);
                // give access to self
                await voterProxy.connect(operator).setStashAccess(operator.address, true);

                expect(await B50WBTC50WETH.balanceOf(voterProxy.address)).to.equals(ONE_HUNDRED_ETHER);
                await voterProxy.connect(operator)['withdraw(address)'](B50WBTC50WETH.address);
                expect(await B50WBTC50WETH.balanceOf(operator.address)).to.equals(ONE_HUNDRED_ETHER);
            });

            it('doesn\'t withdraw protected asset', async function () {
                const { voterProxy, anotherUser: operator, B50WBTC50WETH, gauge } = await setupTests();

                await changeOperator(voterProxy, operator.address);
                // give access to self
                await voterProxy.connect(operator).setStashAccess(operator.address, true);

                await B50WBTC50WETH.mint(voterProxy.address, ONE_HUNDRED_ETHER)
                expect(await B50WBTC50WETH.balanceOf(voterProxy.address)).to.equals(ONE_HUNDRED_ETHER)

                await voterProxy.connect(operator).deposit(B50WBTC50WETH.address, gauge.address)

                await voterProxy.connect(operator)['withdraw(address)'](B50WBTC50WETH.address);
                // gauge should have the same amount of tokens
                expect(await B50WBTC50WETH.balanceOf(gauge.address)).to.equals(ONE_HUNDRED_ETHER)
            });

            it('reverts if unauthorized', async function () {
                const { voterProxy } = await setupTests();

                await expect(voterProxy['withdraw(address,address,uint256)'](ONE_ADDRESS, ONE_ADDRESS, ONE_HUNDRED_ETHER))
                    .to.be.revertedWith('Unauthorized()')
            });
        });

        context('withdraw(address,address,uint256)', async function () {

            it('reverts if unauthorized', async function () {
                const { voterProxy, anotherUser: operator, B50WBTC50WETH, gauge } = await setupTests();

                await expect(voterProxy.connect(operator)['withdraw(address,address,uint256)'](B50WBTC50WETH.address, gauge.address, 1))
                    .to.be.revertedWith('Unauthorized()');
            });

            it('withdraws amount', async function () {
                const { voterProxy, anotherUser: operator, B50WBTC50WETH, gauge } = await setupTests();

                await changeOperator(voterProxy, operator.address);

                // mint token to proxy and gauge
                await B50WBTC50WETH.mint(voterProxy.address, ONE_HUNDRED_ETHER)
                await B50WBTC50WETH.mint(gauge.address, ONE_HUNDRED_ETHER)

                // check balance before withdrawal
                expect(await B50WBTC50WETH.balanceOf(voterProxy.address)).to.equals(ONE_HUNDRED_ETHER)

                const fiftyEther = ethers.utils.parseEther('50')
                const oneHundredFiftyEther = ONE_HUNDRED_ETHER.add(fiftyEther);

                // Withdraw 100 ethers from voterProxy and 50 from gauge
                expect(await voterProxy.connect(operator)['withdraw(address,address,uint256)'](B50WBTC50WETH.address, gauge.address, oneHundredFiftyEther))
                // validate balances after withdrawal
                expect(await B50WBTC50WETH.balanceOf(voterProxy.address)).to.equals(0)
                expect(await B50WBTC50WETH.balanceOf(gauge.address)).to.equals(fiftyEther)
            });
        });

        context('withdrawAll(address,address)', async function () {
            it('withdraws all', async function () {
                const { voterProxy, anotherUser: operator, B50WBTC50WETH, gauge } = await setupTests();

                await changeOperator(voterProxy, operator.address);

                // mint token to proxy and gauge
                await B50WBTC50WETH.mint(voterProxy.address, ONE_HUNDRED_ETHER)
                await B50WBTC50WETH.mint(gauge.address, ONE_HUNDRED_ETHER)

                await voterProxy.connect(operator)['withdrawAll(address,address)'](B50WBTC50WETH.address, gauge.address)

                expect(await B50WBTC50WETH.balanceOf(operator.address)).to.equals(ONE_HUNDRED_ETHER.mul(2)) // 200 ether
            });
        });

        context('createLock', async function () {
            it('reverts if unauthorized', async function () {
                const { voterProxy, anotherUser } = await setupTests();

                await expect(voterProxy.connect(anotherUser).createLock(1, 1))
                    .to.be.revertedWith('Unauthorized()');
            });

            it('creates a lock', async function () {
                const { voterProxy, anotherUser } = await setupTests();

                await voterProxy.setDepositor(anotherUser.address)

                await voterProxy.connect(anotherUser).createLock(ONE_HUNDRED_ETHER, getFutureTimestamp(365))
            });
        });

        context('increaseAmount', async function () {
            it('reverts if unauthorized', async function () {
                const { voterProxy, anotherUser } = await setupTests();

                await expect(voterProxy.connect(anotherUser).increaseAmount(1))
                    .to.be.revertedWith('Unauthorized()');
            });

            it('increases amount', async function () {
                const { voterProxy, anotherUser } = await setupTests();

                await voterProxy.setDepositor(anotherUser.address)

                await voterProxy.connect(anotherUser).createLock(ONE_HUNDRED_ETHER, getFutureTimestamp(365))

                await voterProxy.connect(anotherUser).increaseAmount(1)
            });
        });

        context('increaseTime', async function () {
            it('reverts if unauthorized', async function () {
                const { voterProxy, anotherUser } = await setupTests();

                await expect(voterProxy.connect(anotherUser).increaseTime(1))
                    .to.be.revertedWith('Unauthorized()');
            });

            it('increases time', async function () {
                const { voterProxy, anotherUser } = await setupTests();

                await voterProxy.setDepositor(anotherUser.address)

                // lock for 100 days
                await voterProxy.connect(anotherUser).createLock(ONE_HUNDRED_ETHER, getFutureTimestamp(100))

                // increase lock to 200 days
                const nextUnlock = getFutureTimestamp(200)

                await voterProxy.connect(anotherUser).increaseTime(nextUnlock)
            });
        });

        context('release', async function () {
            it('reverts if unauthorized', async function () {
                const { voterProxy, anotherUser } = await setupTests();

                await expect(voterProxy.connect(anotherUser).release())
                    .to.be.revertedWith('Unauthorized()');
            });

            it('increases time', async function () {
                const { voterProxy, anotherUser } = await setupTests();

                await voterProxy.setDepositor(anotherUser.address)

                await voterProxy.connect(anotherUser).release()
            });
        });

        context('vote', async function () {
            it('reverts if unauthorized', async function () {
                const { voterProxy, anotherUser } = await setupTests();

                await expect(voterProxy.connect(anotherUser).vote(1, ZERO_ADDRESS, true))
                    .to.be.revertedWith('Unauthorized()');
            });

            it('votes', async function () {
                const { voterProxy, anotherUser: operator, votingMock } = await setupTests();

                await changeOperator(voterProxy, operator.address);

                await voterProxy.connect(operator).vote(1, votingMock.address, true);
            });
        });

        context('voteGaugeWeight', async function () {
            it('reverts if unauthorized', async function () {
                const { voterProxy, anotherUser } = await setupTests();

                await expect(voterProxy.connect(anotherUser).voteGaugeWeight(ZERO_ADDRESS, 1))
                    .to.be.revertedWith('Unauthorized()');
            });

            it('votes', async function () {
                const { voterProxy, anotherUser: operator } = await setupTests();

                await changeOperator(voterProxy, operator.address);

                await voterProxy.connect(operator).voteGaugeWeight(ZERO_ADDRESS, 1);
            });
        });

        context('voteMultipleGauges', async function () {
            it('reverts if unauthorized', async function () {
                const { voterProxy, anotherUser } = await setupTests();

                await expect(voterProxy.connect(anotherUser).voteMultipleGauges([ZERO_ADDRESS], [1]))
                    .to.be.revertedWith('Unauthorized()');
            });

            it('reverts if bad input', async function () {
                const { voterProxy, anotherUser: operator } = await setupTests();

                await changeOperator(voterProxy, operator.address);

                await expect(voterProxy.connect(operator).voteMultipleGauges([ZERO_ADDRESS], [1, 1]))
                    .to.be.revertedWith('BadInput()');
            });

            it('votes', async function () {
                const { voterProxy, anotherUser: operator } = await setupTests();

                await changeOperator(voterProxy, operator.address);

                await voterProxy.connect(operator).voteMultipleGauges([ZERO_ADDRESS], [1]);
            });
        });

        context('claimBal', async function () {
            it('reverts on unauthorized', async function () {
                const { voterProxy } = await setupTests();

                await expect(voterProxy.claimBal(ZERO_ADDRESS))
                    .to.be.revertedWith('Unauthorized()');
            });

            it('claims bal', async function () {
                const { voterProxy, anotherUser: operator, bal } = await setupTests();

                await changeOperator(voterProxy, operator.address);

                expect(await bal.balanceOf(operator.address)).to.equals(0)
                // Mintr mock doesn't care about zero address
                await voterProxy.connect(operator).claimBal(ZERO_ADDRESS)

                // mintr mock mints 100 bal
                expect(await bal.balanceOf(operator.address)).to.equals(ONE_HUNDRED_ETHER)
            });
        });

        context('claimRewards', async function () {
            it('reverts on unauthorized', async function () {
                const { voterProxy } = await setupTests();

                await expect(voterProxy.claimRewards(ZERO_ADDRESS))
                    .to.be.revertedWith('Unauthorized()');
            });

            it('claims rewards', async function () {
                const { voterProxy, anotherUser: operator, gauge } = await setupTests();

                await changeOperator(voterProxy, operator.address);

                // gauge mock doesn't throw
                await voterProxy.connect(operator).claimRewards(gauge.address)
            });
        });

        context('claimFees', async function () {
            it('reverts on unauthorized', async function () {
                const { voterProxy } = await setupTests();

                await expect(voterProxy.claimFees(ZERO_ADDRESS, ZERO_ADDRESS))
                    .to.be.revertedWith('Unauthorized()');
            });

            it('claims fees', async function () {
                const { voterProxy, anotherUser: operator, bal, distro } = await setupTests();

                await changeOperator(voterProxy, operator.address);

                await bal.mint(voterProxy.address, ONE_HUNDRED_ETHER);
                expect(await bal.balanceOf(voterProxy.address)).to.equals(ONE_HUNDRED_ETHER)

                // distro mock does nothing
                await voterProxy.connect(operator).claimFees(distro.address, bal.address)
                expect(await bal.balanceOf(voterProxy.address)).to.equals(0)
                expect(await bal.balanceOf(operator.address)).to.equals(ONE_HUNDRED_ETHER)
            });
        });

        context('execute', async function () {
            it('reverts on unauthorized', async function () {
                const { voterProxy } = await setupTests();

                await expect(voterProxy.execute(ZERO_ADDRESS, 0, "0x"))
                    .to.be.revertedWith('Unauthorized()');
            });

            it('executes calldata with value', async function () {
                const { voterProxy, externalContract, anotherUser: operator } = await setupTests();

                await changeOperator(voterProxy, operator.address);

                const number = 1337;
                const factory = await ethers.getContractFactory('ExternalContractMock')
                const tx = factory.interface.encodeFunctionData('works', [number]);

                await expect(voterProxy.connect(operator).execute(externalContract.address, 0, tx))
                    .to.emit(externalContract, 'Yay')
                    .withArgs(number)
            });
        });
    });
});

const changeOperator = async function (voterProxy, operator) {
    await expect(voterProxy.setOperator(operator))
        .to.emit(voterProxy, 'OperatorChanged')
        .withArgs(operator);
}