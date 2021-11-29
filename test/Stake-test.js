import { BN, fromWei, toWei } from 'web3-utils'
import ether from './helpers/ether'
import EVMRevert from './helpers/EVMRevert'
import { duration } from './helpers/duration'
import { PairHash } from '../config'


const BigNumber = BN
const timeMachine = require('ganache-time-traveler')

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should()

const ETH_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

// real contracts
const UniswapV2Factory = artifacts.require('./UniswapV2Factory.sol')
const UniswapV2Router = artifacts.require('./UniswapV2Router02.sol')
const UniswapV2Pair = artifacts.require('./UniswapV2Pair.sol')
const WETH = artifacts.require('./WETH9.sol')
const TOKEN = artifacts.require('./TOKEN.sol')
const Stake = artifacts.require('./Stake.sol')
const NFT = artifacts.require('./NFT.sol')
const NFTPrice = toWei("1")

const Beneficiary = "0x6ffFe11A5440fb275F30e0337Fc296f938a287a5"

const stakeDuration = duration.days(30)
const antiDumpingDelay = duration.days(1)

let uniswapV2Factory,
    uniswapV2Router,
    weth,
    token,
    pair,
    pairAddress,
    stake,
    nft


contract('Stake', function([userOne, userTwo, userThree]) {

  async function deployContracts(){
    // deploy contracts
    uniswapV2Factory = await UniswapV2Factory.new(userOne)
    weth = await WETH.new()
    uniswapV2Router = await UniswapV2Router.new(uniswapV2Factory.address, weth.address)
    token = await TOKEN.new(uniswapV2Router.address)
    nft = await NFT.new(10000, userOne, "https://gateway.pinata.cloud/ipfs/QmNVZdcfwaadBzKkDFfGXtqNdKwEbMsQY5xZJxfSxNcK2i/1/", ".json")

    // add token liquidity
    await token.approve(uniswapV2Router.address, toWei(String(500)))

    await uniswapV2Router.addLiquidityETH(
      token.address,
      toWei(String(500)),
      1,
      1,
      userOne,
      "1111111111111111111111"
    , { from:userOne, value:toWei(String(500)) })

    pairAddress = await uniswapV2Factory.allPairs(0)
    pair = await UniswapV2Pair.at(pairAddress)

    stake = await Stake.new(
      userOne,
      token.address,
      pair.address,
      nft.address,
      stakeDuration,
      100,
      NFTPrice,
      userOne,
      antiDumpingDelay
    )

    // transfer ownership from nft to stake
    await nft.transferOwnership(stake.address)

    // add some rewards to claim stake
    stake.setRewardsDistribution(userOne)
    token.transfer(stake.address, toWei(String(1)))
    stake.notifyRewardAmount(toWei(String(1)))

    // exclude stake from fee and balance limit
    await token.excludeFromFee(stake.address)
    await token.excludeFromTransferLimit(stake.address)

    // send some tokens to another users
    await token.transfer(userTwo, toWei(String(1)))
    await token.transfer(userThree, toWei(String(1)))

    // update white list for users
    await stake.updateWhiteList(userOne, true)
    await stake.updateWhiteList(userTwo, true)
    await stake.updateWhiteList(userThree, true)
  }

  beforeEach(async function() {
    await deployContracts()
  })

  describe('INIT stake', function() {
    it('Correct init Stake', async function() {
      assert.equal(await stake.rewardsToken(), token.address)
      assert.equal(await stake.stakingToken(), pair.address)
    })
  })

  describe('Update white list', function() {
    it('Owner can call updateWhiteList', async function() {
      await stake.updateWhiteList(userOne, false)
      assert.equal(await stake.whiteList(userOne), false)
    })

    it('Not owner can not call updateWhiteList', async function() {
      await stake.updateWhiteList(userOne, false, { from:userTwo })
      .should.be.rejectedWith(EVMRevert)
    })
  })

  describe('Update anti dumping delay', function() {
    it('Owner can call updateAntiDumpingDelay', async function() {
      assert.notEqual(await stake.antiDumpingDelay(), 0)
      await stake.updateAntiDumpingDelay(0)
      assert.equal(await stake.antiDumpingDelay(), 0)
    })

    it('Not owner can not call updateAntiDumpingDelay', async function() {
      await stake.updateAntiDumpingDelay(0, { from:userTwo })
      .should.be.rejectedWith(EVMRevert)
    })
  })

  describe('Claim NFT', function() {
    it('User can not claim without stake', async function() {
      await stake.claimNFT(0)
      .should.be.rejectedWith(EVMRevert)
    })

    it('User can claim after stake', async function() {
      assert.equal(await nft.balanceOf(userOne), 0)
      // stake
      const toStake = await pair.balanceOf(userOne)
      await pair.approve(stake.address, toStake)
      await stake.stake(toStake)
      await stake.claimNFT(0)
      assert.equal(await nft.balanceOf(userOne), 1)
    })

    it('User can not claim twice', async function() {
      // stake
      const toStake = await pair.balanceOf(userOne)
      await pair.approve(stake.address, toStake)
      await stake.stake(toStake)

      await stake.claimNFT(0)
      await stake.claimNFT(1)
      .should.be.rejectedWith(EVMRevert)
    })
  })

  describe('Buy NFT', function() {
    it('User can not buy NFT without ETH', async function() {
      await stake.buyNFT(0, {from:userTwo})
      .should.be.rejectedWith(EVMRevert)
    })

    it('User can not buy NFT with not enough amount of ETH', async function() {
      await stake.buyNFT(0, {from:userTwo, value:Number(NFTPrice) / 2})
      .should.be.rejectedWith(EVMRevert)
    })

    it('User can buy NFT with enough amount of ETH and NFT receiver get ETH', async function() {
      const receiverBalanceBefore = Number(fromWei(await web3.eth.getBalance(userOne)))

      assert.equal(await nft.balanceOf(userTwo), 0)
      await stake.buyNFT(0, {from:userTwo, value:NFTPrice})
      assert.equal(await nft.balanceOf(userTwo), 1)

      const receiverBalanceAfter = Number(fromWei(await web3.eth.getBalance(userOne)))
      assert.isTrue(receiverBalanceAfter > receiverBalanceBefore)
    })
  })

  describe('Stake increase rewards logs', function() {
    it('_', async function() {
      // stake should not have any pool
      assert.equal(await pair.balanceOf(stake.address), 0)
      // amount to stake
      const toStake = await pair.balanceOf(userOne)
      assert.isTrue(toStake > 0)
      // stake
      await pair.approve(stake.address, toStake)
      await stake.stake(toStake)
      // stake should get pool
      assert.equal(Number(await pair.balanceOf(stake.address)), Number(toStake))
      // shares should be same as stake
      const shares = await stake.balanceOf(userOne)
      assert.equal(Number(shares), Number(toStake))

      // logs eraned
      console.log("without new rewards, total rewards 1 COT")
      let curDay = 5
      for(let i=0; i < 6; i++){
        await timeMachine.advanceTimeAndBlock(duration.days(5))
        console.log(
          "Day ", curDay, " - ",
          Number(fromWei(String(await stake.earned(userOne)))).toFixed(2), "Earned "
        )

        curDay = curDay+5
      }

      // clear user balance
      await token.transfer(userTwo, await token.balanceOf(userOne))
      assert.equal(await token.balanceOf(userOne), 0)

      // withdraw
      await stake.exit()
      // stake should send all pools
      assert.equal(await pair.balanceOf(stake.address), 0)
      // user should get back all pools
      assert.equal(Number(await pair.balanceOf(userOne)), Number(toStake))
      // user should get stake rewards
      assert.notEqual(await token.balanceOf(userOne), 0)
    })

    it('_', async function() {
      // stake should not have any pool
      assert.equal(await pair.balanceOf(stake.address), 0)
      // amount to stake
      const toStake = await pair.balanceOf(userOne)
      assert.isTrue(toStake > 0)
      // stake
      await pair.approve(stake.address, toStake)
      await stake.stake(toStake)
      // stake should get pool
      assert.equal(Number(await pair.balanceOf(stake.address)), Number(toStake))
      // shares should be same as stake
      const shares = await stake.balanceOf(userOne)
      assert.equal(Number(shares), Number(toStake))


      // add new rewards
      await token.transfer(stake.address, toWei(String(1)))
      await stake.notifyRewardAmount(toWei(String(1)))
      assert.equal(await token.balanceOf(stake.address), toWei(String(2)))

      // logs eraned
      console.log("with add new rewards, total rewards 2 COT")
      let curDay = 5
      for(let i=0; i < 6; i++){
        await timeMachine.advanceTimeAndBlock(duration.days(5))
        console.log(
          "Day ", curDay, " - ",
          Number(fromWei(String(await stake.earned(userOne)))).toFixed(2), "Earned "
        )

        curDay = curDay+5
      }

      // clear user balance
      await token.transfer(userTwo, await token.balanceOf(userOne))
      assert.equal(await token.balanceOf(userOne), 0)

      // withdraw
      await stake.exit()
      // stake should send all pools
      assert.equal(await pair.balanceOf(stake.address), 0)
      // user should get back all pools
      assert.equal(Number(await pair.balanceOf(userOne)), Number(toStake))
      // user should get stake rewards
      assert.notEqual(await token.balanceOf(userOne), 0)
    })
  })


  describe('Stake', function() {
    it('User can not claim ahead of anti dumping time', async function() {
      // stake should not have any pool
      assert.equal(await pair.balanceOf(stake.address), 0)
      // amount to stake
      const toStake = await pair.balanceOf(userOne)
      assert.isTrue(toStake > 0)
      // stake
      await pair.approve(stake.address, toStake)
      await stake.stake(toStake)
      // exit
      await stake.getReward().should.be.rejectedWith(EVMRevert)
    })


    it('User can claim ahead after anti dumping time', async function() {
      // stake should not have any pool
      assert.equal(await pair.balanceOf(stake.address), 0)
      // amount to stake
      const toStake = await pair.balanceOf(userOne)
      assert.isTrue(toStake > 0)
      // stake
      await pair.approve(stake.address, toStake)
      await stake.stake(toStake)
      await timeMachine.advanceTimeAndBlock(antiDumpingDelay + 1)
      // exit
      await stake.getReward()
    })

    it('User can not stake if stake not in white list', async function() {
      // stake should not have any pool
      assert.equal(await pair.balanceOf(stake.address), 0)
      // amount to stake
      const toStake = await pair.balanceOf(userOne)
      assert.isTrue(toStake > 0)

      await stake.updateWhiteList(userOne, false)

      // stake
      await pair.approve(stake.address, toStake)
      await stake.stake(toStake).should.be.rejectedWith(EVMRevert)
    })

    it('Can be staked and withdrawed', async function() {
      // stake should not have any pool
      assert.equal(await pair.balanceOf(stake.address), 0)
      // amount to stake
      const toStake = await pair.balanceOf(userOne)
      assert.isTrue(toStake > 0)
      // stake
      await pair.approve(stake.address, toStake)
      await stake.stake(toStake)
      // stake should get pool
      assert.equal(Number(await pair.balanceOf(stake.address)), Number(toStake))
      // shares should be same as stake
      const shares = await stake.balanceOf(userOne)
      assert.equal(Number(shares), Number(toStake))
      await timeMachine.advanceTimeAndBlock(stakeDuration + duration.days(1))
      // exit
      await stake.exit()
      // stake should send all pools
      assert.equal(await pair.balanceOf(stake.address), 0)
      // user should get back all pools
      assert.equal(Number(await pair.balanceOf(userOne)), Number(toStake))
    })

    it('User should get rewards after time', async function() {
      // stake
      const toStake = await pair.balanceOf(userOne)
      await pair.approve(stake.address, toStake)
      await stake.stake(toStake)
      // check rewards
      const stakeRewards = await token.balanceOf(stake.address)
      assert.isTrue(stakeRewards > 0)
      const tokenBalanceBefore = await token.balanceOf(userOne)

      // increase time
      await timeMachine.advanceTimeAndBlock(duration.days(36))
      const calculateRewards = Number(toStake) * Number(await stake.rewardPerToken())
      // console.log(Number(toStake))
      // console.log(Number(await stake.rewardPerToken()))
      // console.log(Number(calculateRewards).toLocaleString('fullwide', {useGrouping:false}))
      // withdraw
      await stake.exit()
      // user should get all rewards
      assert.isTrue(Number(await token.balanceOf(userOne)) > Number(tokenBalanceBefore))
    })

    it('eranedByShare should be the same as earned', async function() {
      // stake
      const toStake = await pair.balanceOf(userOne)
      await pair.approve(stake.address, toStake)
      await stake.stake(toStake)
      // increase time
      await timeMachine.advanceTimeAndBlock(stakeDuration + duration.days(1))
      assert.equal(
        Number(await stake.earned(userOne)),
        Number(await stake.earnedByShare(await stake.balanceOf(userOne)))
      )
    })

    it('User who join early get more rewards', async function() {
      // stake 1 pool token from user 1
      await pair.approve(stake.address, toWei(String(1)))
      await stake.stake(toWei(String(1)))
      // increase time
      await timeMachine.advanceTimeAndBlock(duration.days(15))

      await pair.transfer(userTwo, toWei(String(1)))
      // stake 1 pool token from user 2
      await pair.approve(stake.address, toWei(String(1)), {from:userTwo})
      await stake.stake(toWei(String(1)), {from:userTwo})
      await timeMachine.advanceTimeAndBlock(duration.days(15))
      assert.isTrue(Number(await stake.earned(userOne)) > Number(await stake.earned(userTwo)))
    })

    it('User who join early get more rewards via use stakeFor', async function() {
      // stake 1 pool token from user 1
      await pair.approve(stake.address, toWei(String(2)))
      await stake.stakeFor(toWei(String(1)), userOne)
      // increase time
      await timeMachine.advanceTimeAndBlock(duration.days(15))
      // stake 1 pool token from user 1 for user 2
      await stake.stakeFor(toWei(String(1)), userTwo)
      await timeMachine.advanceTimeAndBlock(duration.days(15))
      assert.isTrue(Number(await stake.earned(userOne)) > Number(await stake.earned(userTwo)))
    })

    it('Users who join in the same time get the same rewards even if exit not in the same time even if exit much later', async function() {
      // clear rewards balance
      await token.transfer(userThree, await token.balanceOf(userOne), { from:userOne })
      await token.transfer(userThree, await token.balanceOf(userTwo), { from:userTwo })

      // stake 1 pool token from user 1
      await pair.approve(stake.address, toWei(String(2)))
      await stake.stakeFor(toWei(String(1)), userOne)
      await stake.stakeFor(toWei(String(1)), userTwo)
      await timeMachine.advanceTimeAndBlock(stakeDuration + duration.days(1))

      assert.equal(
        Number(await stake.earned(userOne)),
        Number(await stake.earned(userTwo))
      )

      // users not hold any rewards
      assert.equal(Number(await token.balanceOf(userOne)), 0)
      assert.equal(Number(await token.balanceOf(userTwo)), 0)

      // exit
      await timeMachine.advanceTimeAndBlock(stakeDuration + duration.days(1))
      await stake.exit( {from:userOne} )

      await timeMachine.advanceTimeAndBlock(stakeDuration + duration.days(1))
      await stake.exit( {from:userTwo} )

      assert.isTrue(Number(await token.balanceOf(userTwo)) > 0)

      assert.equal(
        Number(await token.balanceOf(userOne)),
        Number(await token.balanceOf(userTwo))
      )
    })

    it('User who join 2 times via use stakeFor not lose rewards', async function() {
      // stake 1 pool token from user 1
      await pair.approve(stake.address, toWei(String(3)))
      await stake.stakeFor(toWei(String(1)), userOne)
      // increase time
      await timeMachine.advanceTimeAndBlock(duration.days(15))
      // stake 1 pool token from user 1 for user 2
      await stake.stakeFor(toWei(String(1)), userTwo)
      // add small amount from user 1
      const userOneBeforeDeposit = Number(await stake.earned(userOne))
      await stake.stakeFor(toWei(String(0.01)), userOne)
      // increase time
      await timeMachine.advanceTimeAndBlock(duration.days(15))
      // user 1 shouldnt lose rewards
      assert.isTrue(Number(await stake.earned(userOne)) > userOneBeforeDeposit)
      assert.isTrue(Number(await stake.earned(userOne)) > Number(await stake.earned(userTwo)))
    })

    it('User A claim not affect to user B rewards', async function() {
      // clear users balances
      await token.transfer(userThree, await token.balanceOf(userOne))
      await token.transfer(userThree, await token.balanceOf(userTwo), { from:userTwo })
      // stake 1 pool token from user 1
      await pair.approve(stake.address, toWei(String(3)))
      await stake.stakeFor(toWei(String(1)), userOne)
      // increase time
      await timeMachine.advanceTimeAndBlock(duration.days(15))
      // stake 1 pool token from user 1 for user 2
      await stake.stakeFor(toWei(String(1)), userTwo)
      // increase time
      await timeMachine.advanceTimeAndBlock(duration.days(15))
      const userOneEarned = await stake.earned(userOne)
      const userTwoEarned = await stake.earned(userTwo)

      // call few times from user 1
      await stake.getReward()
      await stake.getReward()
      await stake.getReward()

      // call from user 2
      await stake.getReward({ from:userTwo })

      assert.equal(Number(userOneEarned), Number(await token.balanceOf(userOne)))
      assert.equal(Number(userTwoEarned), Number(await token.balanceOf(userTwo)))
    })
  })
  //END
})
