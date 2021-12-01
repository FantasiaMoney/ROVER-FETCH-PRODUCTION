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
const Sale = artifacts.require('./Sale.sol')

const Beneficiary = "0x6ffFe11A5440fb275F30e0337Fc296f938a287a5"

let uniswapV2Factory,
    uniswapV2Router,
    weth,
    token,
    pair,
    pairAddress,
    sale


contract('Sale-test', function([userOne, userTwo, userThree]) {

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

    sale = await Sale.new(
      token.address,
      userOne,
      uniswapV2Router.address
    )

    // exclude sale from fee and balance limit
    await token.excludeFromFee(sale.address)
    await token.excludeFromTransferLimit(sale.address)

    // send tokens to sale
    await token.transfer(sale.address, await token.balanceOf(userOne))

    // update white list for users
    await sale.updateWhiteList(userOne, true)
    await sale.updateWhiteList(userTwo, true)
    await sale.updateWhiteList(userThree, true)
  }

  beforeEach(async function() {
    await deployContracts()
  })

  describe('INIT Sale', function() {
    it('Correct init token sale', async function() {
      assert.equal(await sale.token(), token.address)
      assert.equal(await sale.Router(), uniswapV2Router.address)
    })
  })


  describe('Migration', function() {
    it('Not owner can not call blockMigrate', async function() {
       await sale.blockMigrate({ from:userTwo })
       .should.be.rejectedWith(EVMRevert)
    })

    it('Not owner can not call migrate', async function() {
       await sale.migrate(
         userTwo,
         await token.balanceOf(sale.address),
         { from:userTwo }
       )
       .should.be.rejectedWith(EVMRevert)
    })

    it('Not owner can not call finish', async function() {
       await sale.finish({ from:userTwo })
       .should.be.rejectedWith(EVMRevert)
    })

    it('Owner can call blockMigrate', async function() {
       await sale.blockMigrate()
    })

    it('Owner can call migrate', async function() {
       assert.notEqual(Number(await token.balanceOf(sale.address)), 0)
       await sale.migrate(
         userTwo,
         await token.balanceOf(sale.address),
       )
       assert.equal(Number(await token.balanceOf(sale.address)), 0)
    })

    it('Owner can not call migrate after blockMigrate', async function() {
       await sale.blockMigrate()
       await sale.migrate(
         userTwo,
         await token.balanceOf(sale.address)
       )
       .should.be.rejectedWith(EVMRevert)
    })

    it('Owner can call finish', async function() {
       assert.notEqual(Number(await token.balanceOf(sale.address)), 0)
       await sale.finish()
       assert.equal(Number(await token.balanceOf(sale.address)), 0)
    })
  })

  describe('Update white list', function() {
    it('Owner can call updateWhiteList', async function() {
      await sale.updateWhiteList(userOne, false)
      assert.equal(await sale.whiteList(userOne), false)
    })

    it('Not owner can not call updateWhiteList', async function() {
      await sale.updateWhiteList(userOne, false, { from:userTwo })
      .should.be.rejectedWith(EVMRevert)
    })
  })

  describe('Update benificiary', function() {
    it('Not owner can not call updateBeneficiary', async function() {
      await sale.updateBeneficiary(userTwo, { from:userTwo })
      .should.be.rejectedWith(EVMRevert)
    })

    it('Owner can call updateBeneficiary', async function() {
      await sale.updateBeneficiary(userTwo)
      assert.equal(await sale.beneficiary(), userTwo)
    })
  })

  describe('Token sale', function() {
    it('Not Owner can NOT pause and unpause sale ', async function() {
      await sale.pause({ from:userTwo })
      .should.be.rejectedWith(EVMRevert)

      await sale.unpause({ from:userTwo })
      .should.be.rejectedWith(EVMRevert)
    })

    it('Owner can pause and unpause sale ', async function() {
      await sale.pause()
      await sale.buy({ from:userTwo, value:toWei(String(1)) })
      .should.be.rejectedWith(EVMRevert)

      await sale.unpause()
      const tokenBalanceBefore = await token.balanceOf(userTwo)
      await sale.buy({ from:userTwo, value:toWei(String(1)) })
      assert.isTrue(
        await token.balanceOf(userTwo) > tokenBalanceBefore
      )
    })

    it('User can buy from sale, just send ETH', async function() {
      const tokenBalanceBefore = await token.balanceOf(userTwo)

      await sale.sendTransaction({
        value: toWei(String(1)),
        from:userTwo
      })

      assert.isTrue(
        await token.balanceOf(userTwo) > tokenBalanceBefore
      )
    })

    it('User can buy from sale, via call function buy', async function() {
      const tokenBalanceBefore = await token.balanceOf(userTwo)

      await sale.buy({ from:userTwo, value:toWei(String(1)) })

      assert.isTrue(
        await token.balanceOf(userTwo) > tokenBalanceBefore
      )
    })


    it('User not in white list can not call function buy', async function() {
      await sale.updateWhiteList(userTwo, false)
      await sale.buy({ from:userTwo, value:toWei(String(1)) })
      .should.be.rejectedWith(EVMRevert)
    })

    it('Sale rate should be same as in DEX ', async function() {
      const saleRate = await sale.getSalePrice(toWei(String(1)))

      const dexRate = await uniswapV2Router.getAmountsOut(
        toWei(String(1)),
        [weth.address, token.address]
      )

      assert.equal(
        Number(saleRate),
        Number(dexRate[1])
      )
    })
  })
  //END
})
