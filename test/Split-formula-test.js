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
const WTOKEN = artifacts.require('./WTOKEN.sol')
const TOKEN = artifacts.require('./TOKEN.sol')
const Stake = artifacts.require('./Stake.sol')
const Fetch = artifacts.require('./Fetch.sol')
const NFT = artifacts.require('./NFT.sol')
const Sale = artifacts.require('./SaleWithLD.sol')
const SplitFormula = artifacts.require('./SplitFormula')
const LDManager = artifacts.require('./LDManager')
const DAI = artifacts.require('./DAI')

const url = "https://gateway.pinata.cloud/ipfs/QmNVZdcfwaadBzKkDFfGXtqNdKwEbMsQY5xZJxfSxNcK2i/1/"
const nftType = ".json"
const NFTPrice = toWei("1")
const MINLDAmountInDAI = toWei("1000")
const MAXLDAmountInDAI = toWei("3000")
const DAIRatePer1000ETH = toWei(String(100000))

const stakeDuration = duration.years(5)
const antiDumpingDelay = duration.days(30)

let pancakeFactory,
    pancakeRouter,
    weth,
    token,
    pair,
    pancakePairAddress,
    stake,
    stakeSecond,
    fetch,
    nft,
    sale,
    wtoken,
    splitFormula,
    splitFormulaSecond,
    ldManager,
    dai,
    tenOfTotalSupply


contract('Split-formula-test', function([userOne, userTwo, userThree]) {

  async function deployContracts(){
    // deploy contracts
    weth = await WETH.new()
    dai = await DAI.new(DAIRatePer1000ETH)

    pancakeFactory = await UniswapV2Factory.new(userOne)
    pancakeRouter = await UniswapV2Router.new(pancakeFactory.address, weth.address)

    token = await TOKEN.new(pancakeRouter.address)
    wtoken = await WTOKEN.new(token.address)

    const initTokenRate = BigNumber(BigNumber(BigNumber(await token.totalSupply()).dividedBy(1000)).integerValue()).toString(10)

    // add token liquidity to Pancake
    await token.approve(pancakeRouter.address, initTokenRate)
    await pancakeRouter.addLiquidityETH(
      token.address,
      initTokenRate,
      1,
      1,
      userOne,
      "1111111111111111111111"
    , { from:userOne, value:toWei(String(0.1)) })

    pancakePairAddress = await pancakeFactory.allPairs(0)
    pair = await UniswapV2Pair.at(pancakePairAddress)

    nft = await NFT.new(10000, userOne, url, nftType)

    // ADD DAI to LD
    await dai.approve(pancakeRouter.address, DAIRatePer1000ETH)
    await pancakeRouter.addLiquidityETH(
      dai.address,
      DAIRatePer1000ETH,
      1,
      1,
      userOne,
      "1111111111111111111111"
    , { from:userOne, value:toWei(String(1000)) })

    const initialRate = await pancakeRouter.getAmountsOut(
      1000000000,
      [token.address, weth.address]
    )

    splitFormula = await SplitFormula.new(
      initialRate[1],
      MINLDAmountInDAI,
      MAXLDAmountInDAI,
      pancakeRouter.address,
      pair.address,
      token.address,
      dai.address
    )
  }

  beforeEach(async function() {
    await deployContracts()
  })


describe('Update MIN, MAX LD and Price', function() {
    it('Not owner can not call updateMaxPrice', async function() {
       await splitFormula.updateMaxPrice(1, { from:userTwo })
       .should.be.rejectedWith(EVMRevert)
    })

    it('Not owner can not call updateMinLDAmountInDAI', async function() {
       await splitFormula.updateMinLDAmountInDAI(1, { from:userTwo })
       .should.be.rejectedWith(EVMRevert)
    })

    it('Not owner can not call updateMaxLDAmountInDAI', async function() {
       await splitFormula.updateMaxLDAmountInDAI(1, { from:userTwo })
       .should.be.rejectedWith(EVMRevert)
    })


    it('Owner can call updateMaxPrice', async function() {
       assert.notEqual(await splitFormula.maxPrice(), 1)
       await splitFormula.updateMaxPrice(1)
       assert.equal(await splitFormula.maxPrice(), 1)
    })

    it('Owner can call updateMinLDAmountInDAI', async function() {
       assert.notEqual(await splitFormula.minLDAmountInDAI(), 1)
       await splitFormula.updateMinLDAmountInDAI(1)
       assert.equal(await splitFormula.minLDAmountInDAI(), 1)
    })

    it('Owner can call updateMaxLDAmountInDAI', async function() {
       assert.notEqual(await splitFormula.maxLDAmountInDAI(), 1)
       await splitFormula.updateMaxLDAmountInDAI(1)
       assert.equal(await splitFormula.maxLDAmountInDAI(), 1)
    })
})

describe('Split formula', function() {
    it('Should be 100% to dex and 0% to sell', async function() {
       const splitData = await splitFormula.calculateToSplit(toWei("1"))
       assert.equal(Number(splitData[0]), 100)
       assert.equal(Number(splitData[1]), 0)

       console.log(
         "To dex ", Number(splitData[0]),
         "To sell ", Number(splitData[1]),
         "Total LD in DAI",
         Number(fromWei(await splitFormula.getLDAmountInDAI()))
       )
    })

    it('Should be 75% to dex and 25% to sell after add MINLDAmountInDAI', async function() {
       // add token liquidity to Pancake
       const toAddOfTotalSupply = BigNumber(BigNumber(BigNumber(await token.totalSupply()).dividedBy(5)).integerValue()).toString(10)

       await token.approve(pancakeRouter.address, toAddOfTotalSupply)
       await pancakeRouter.addLiquidityETH(
         token.address,
         toAddOfTotalSupply,
         1,
         1,
         userOne,
         "1111111111111111111111"
       , { from:userOne, value:toWei(String(200)) })


       const splitData = await splitFormula.calculateToSplit(toWei("1"))

       assert.equal(Number(splitData[0]), 75)
       assert.equal(Number(splitData[1]), 25)

       console.log(
         "To dex ", Number(splitData[0]),
         "To sell ", Number(splitData[1]),
         "Total LD in DAI",
         Number(fromWei(await splitFormula.getLDAmountInDAI()))
       )
    })

    it('Should be 50% to dex and 50% to sell after add MAXLDAmountInDAI', async function() {
       // add token liquidity to Pancake
       const toAddOfTotalSupply = BigNumber(BigNumber(BigNumber(await token.totalSupply()).dividedBy(2)).integerValue()).toString(10)

       await token.approve(pancakeRouter.address, toAddOfTotalSupply)
       await pancakeRouter.addLiquidityETH(
         token.address,
         toAddOfTotalSupply,
         1,
         1,
         userOne,
         "1111111111111111111111"
       , { from:userOne, value:toWei(String(800)) })


       const splitData = await splitFormula.calculateToSplit(toWei("1"))

       assert.equal(Number(splitData[0]), 50)
       assert.equal(Number(splitData[1]), 50)

       console.log(
         "To dex ", Number(splitData[0]),
         "To sell ", Number(splitData[1]),
         "Total LD in DAI",
         Number(fromWei(await splitFormula.getLDAmountInDAI()))
       )
    })

    it('Should be 0% to dex and 100% to sell after 1000x token price', async function() {
       await pancakeRouter.swapExactETHForTokens(
         1,
         [weth.address, token.address],
         userOne,
         "1111111111111111111111"
       , { from:userOne, value:toWei(String(1000000)) })


       const splitData = await splitFormula.calculateToSplit(toWei("1"))

       assert.equal(Number(splitData[0]), 0)
       assert.equal(Number(splitData[1]), 100)

       console.log(
         "To dex ", Number(splitData[0]),
         "To sell ", Number(splitData[1]),
         "Total LD in DAI",
         Number(fromWei(await splitFormula.getLDAmountInDAI()))
       )
    })
 })

  //END
})
