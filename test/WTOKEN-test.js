import { BN, fromWei, toWei } from 'web3-utils'
import ether from './helpers/ether'
import EVMRevert from './helpers/EVMRevert'
import { duration } from './helpers/duration'
import { PairHash } from '../config'
import BigNumber from 'bignumber.js'

const timeMachine = require('ganache-time-traveler')

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BN))
  .should()

const ETH_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

// real contracts
const UniswapV2Factory = artifacts.require('./UniswapV2Factory.sol')
const UniswapV2Router = artifacts.require('./UniswapV2Router02.sol')
const UniswapV2Pair = artifacts.require('./UniswapV2Pair.sol')
const WETH = artifacts.require('./WETH9.sol')
const TOKEN = artifacts.require('./TOKEN.sol')
const WTOKEN = artifacts.require('./WTOKEN.sol')
const Sale = artifacts.require('./Sale.sol')

const Beneficiary = "0x6ffFe11A5440fb275F30e0337Fc296f938a287a5"

let uniswapV2Factory,
    uniswapV2Router,
    weth,
    token,
    pair,
    pairAddress,
    wtoken


contract('WTOKEN', function([userOne, userTwo, userThree]) {

  async function deployContracts(){
    // deploy contracts
    uniswapV2Factory = await UniswapV2Factory.new(userOne)
    weth = await WETH.new()
    uniswapV2Router = await UniswapV2Router.new(uniswapV2Factory.address, weth.address)
    token = await TOKEN.new(uniswapV2Router.address)
    wtoken = await WTOKEN.new(token.address)

    // add token liquidity
    await token.approve(uniswapV2Router.address, toWei(String(500)))

    // exclude router from fee and balance limit
    await token.excludeFromFee(uniswapV2Router.address)
    await token.excludeFromTransferLimit(uniswapV2Router.address)

    const halfOfTotalSupply = BigNumber(BigNumber(BigNumber(await token.totalSupply()).dividedBy(2)).integerValue()).toString(10)

    // add token liquidity to uniswap
    await token.approve(uniswapV2Router.address, halfOfTotalSupply)
    await uniswapV2Router.addLiquidityETH(
      token.address,
      halfOfTotalSupply,
      1,
      1,
      userOne,
      "1111111111111111111111"
    , { from:userOne, value:toWei(String(500)) })

    pairAddress = await uniswapV2Factory.allPairs(0)
    pair = await UniswapV2Pair.at(pairAddress)


    // exclude WTOKEN from fee and balance limit
    await token.excludeFromFee(wtoken.address)
    await token.excludeFromTransferLimit(wtoken.address)
  }

  beforeEach(async function() {
    await deployContracts()
  })

  describe('WTOKEN', function() {
    it('Correct deposit', async function() {
      const toDeposit = await token.balanceOf(userOne)
      assert.isTrue(Number(toDeposit) > 0)
      await token.approve(wtoken.address, toDeposit)
      assert.equal(Number(await wtoken.totalSupply()), 0)
      await wtoken.deposit(toDeposit)
      assert.equal(Number(await wtoken.totalSupply()), Number(toDeposit))
      assert.equal(Number(await wtoken.balanceOf(userOne)), Number(toDeposit))
      assert.equal(Number(await token.balanceOf(userOne)), 0)
    })

    it('Correct withdarw', async function() {
      const toDeposit = await token.balanceOf(userOne)
      assert.isTrue(Number(toDeposit) > 0)
      await token.approve(wtoken.address, toDeposit)
      await wtoken.deposit(toDeposit)
      assert.equal(Number(await wtoken.balanceOf(userOne)), Number(toDeposit))

      await wtoken.withdraw(toDeposit)
      assert.equal(Number(await wtoken.totalSupply()), 0)
      assert.equal(Number(await wtoken.balanceOf(userOne)), 0)
      assert.equal(Number(await token.balanceOf(userOne)), Number(toDeposit))
    })
  })
  //END
})
