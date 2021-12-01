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
const LDManager = artifacts.require('./LDManager')


let uniswapV2Factory,
    uniswapV2Router,
    weth,
    token,
    pair,
    pairAddress,
    ldManager


contract('LD Manager-test', function([userOne, userTwo, userThree]) {

  async function deployContracts(){
    // deploy contracts
    uniswapV2Factory = await UniswapV2Factory.new(userOne)
    weth = await WETH.new()
    uniswapV2Router = await UniswapV2Router.new(uniswapV2Factory.address, weth.address)
    token = await TOKEN.new(uniswapV2Router.address)

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

    ldManager = await LDManager.new(
      uniswapV2Router.address,
      token.address
    )

    // exclude ldManager from fee and balance limit
    await token.excludeFromFee(ldManager.address)
    await token.excludeFromTransferLimit(ldManager.address)

    // send tokens to ldManager
    await token.transfer(ldManager.address, await token.balanceOf(userOne))
  }

  beforeEach(async function() {
    await deployContracts()
  })


  describe('Migration', function() {
    it('Not owner can not call blockMigrate', async function() {
       await ldManager.blockMigrate({ from:userTwo })
       .should.be.rejectedWith(EVMRevert)
    })

    it('Not owner can not call migrate', async function() {
       await ldManager.migrate(
         userTwo,
         await token.balanceOf(ldManager.address),
         { from:userTwo }
       )
       .should.be.rejectedWith(EVMRevert)
    })

    it('Not owner can not call finish', async function() {
       await ldManager.finish({ from:userTwo })
       .should.be.rejectedWith(EVMRevert)
    })

    it('Owner can call blockMigrate', async function() {
       await ldManager.blockMigrate()
    })

    it('Owner can call migrate', async function() {
       assert.notEqual(Number(await token.balanceOf(ldManager.address)), 0)
       await ldManager.migrate(
         userTwo,
         await token.balanceOf(ldManager.address),
       )
       assert.equal(Number(await token.balanceOf(ldManager.address)), 0)
    })

    it('Owner can not call migrate after blockMigrate', async function() {
       await ldManager.blockMigrate()
       await ldManager.migrate(
         userTwo,
         await token.balanceOf(ldManager.address)
       )
       .should.be.rejectedWith(EVMRevert)
    })

    it('Owner can call finish', async function() {
       assert.notEqual(Number(await token.balanceOf(ldManager.address)), 0)
       await ldManager.finish()
       assert.equal(Number(await token.balanceOf(ldManager.address)), 0)
    })
  })
  //END
})
