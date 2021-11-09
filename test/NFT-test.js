import { BN } from 'web3-utils'
import ether from './helpers/ether'
import EVMRevert from './helpers/EVMRevert'
import { toWei, fromWei } from 'web3-utils'

const BigNumber = BN

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should()

const NFT = artifacts.require('./NFT.sol')
const nftsSupply = 10
const url = "https://gateway.pinata.cloud/ipfs/QmNVZdcfwaadBzKkDFfGXtqNdKwEbMsQY5xZJxfSxNcK2i/1/"
const nftType = ".json"

let nft,
    platformAddress


contract('NFT', function([userOne, userTwo, userThree]) {

  async function deployContracts(){
    // deploy contracts
    nft = await NFT.new(nftsSupply, userOne, url, nftType)
    platformAddress = userOne
  }

  beforeEach(async function() {
    await deployContracts()
  })

  describe('NFT URL', function() {
    it('NFT URL should be correct', async function() {
      const urlT = await nft.viewNFTURL("0")
      assert.equal(url + "0" + nftType, urlT)
    })
  })

  describe('Create NFT', function() {
    it('Only owner can create new nft until a certain limit', async function() {
      assert.equal(await nft.totalSupply(), 0)
      await nft.createNewFor(userOne, 0)
      assert.equal(await nft.totalSupply(), 1)
    })

    it('Not owner can NOT create new nft until a certain limit', async function() {
      assert.equal(await nft.totalSupply(), 0)
      await nft.createNewFor(userTwo, 0, { from:userTwo })
      .should.be.rejectedWith(EVMRevert)
      assert.equal(await nft.totalSupply(), 0)
    })

    it('Nobody can create new nft after a certain limit', async function() {
      assert.equal(await nft.totalSupply(), 0)

      for(let i = 0; i<nftsSupply; i++){
        await nft.createNewFor(userOne, i)
      }

      assert.equal(await nft.totalSupply(), nftsSupply)

      await nft.createNewFor(userOne, 0).should.be.rejectedWith(EVMRevert)
    })
  })

  describe('Transfer NFT', function() {
    it('User can transfer all created NFT up to max index ', async function() {
      for(let i = 0; i < nftsSupply; i++){
        await nft.createNewFor(userOne, i)
        await nft.transfer(userTwo, i)
      }
    })
  })

  describe('Offer and Buy NFT', function() {
    it('Owner can offer nft after create', async function() {
      await nft.createNewFor(userOne, 0)
      assert.equal(await nft.ownerOf(0), userOne)
      await nft.offerForSale(0, toWei("0.00001"))
    })

    it('Not owner can NOT offer nft', async function() {
      await nft.createNewFor(userOne, 0)
      await nft.offerForSale(0, toWei("0.00001"), { from:userTwo })
      .should.be.rejectedWith(EVMRevert)
    })

    it('User can not buy with less than min eth require', async function() {
      await nft.createNewFor(userOne, 0)
      await nft.offerForSale(0, toWei("1"))
      await nft.buy(0, { from:userTwo, value:toWei("0.00001") })
      .should.be.rejectedWith(EVMRevert)

      assert.equal(await nft.ownerOf(0), userOne)
    })

    it('User can buy with min eth require', async function() {
      await nft.createNewFor(userOne, 0)
      assert.equal(await nft.ownerOf(0), userOne)

      await nft.offerForSale(0, toWei("1"))
      await nft.buy(0, { from:userTwo, value:toWei("1") })

      assert.equal(await nft.ownerOf(0), userTwo)
    })

    it('User A can not buy with min eth require, if owner offer for user B', async function() {
      await nft.createNewFor(userOne, 0)
      assert.equal(await nft.ownerOf(0), userOne)

      await nft.offerForSaleToAddress(0, toWei("1"), userThree)
      await nft.buy(0, { from:userTwo, value:toWei("1") })
      .should.be.rejectedWith(EVMRevert)

      await nft.buy(0, { from:userThree, value:toWei("1") })

      assert.equal(await nft.ownerOf(0), userThree)
    })


    it('Saller address and platform address receive ETH from sell', async function() {
      await nft.createNewFor(userThree, 0, { from:userOne })

      const platformBalanceBefore = await web3.eth.getBalance(platformAddress)
      const sallerBalanceBefore = await web3.eth.getBalance(userThree)

      await nft.offerForSale(0, toWei("1"), { from:userThree })
      await nft.buy(0, { from:userTwo, value:toWei("1") })

      assert.isTrue(
        await web3.eth.getBalance(platformAddress) > platformBalanceBefore
      )

      assert.isTrue(
        await web3.eth.getBalance(userThree) > sallerBalanceBefore
      )

      console.log(
        "Sale amount 1 ETH",
        "platform received : ",
        fromWei(String(await web3.eth.getBalance(platformAddress) - platformBalanceBefore)),
        "saller received : ",
        fromWei(String(await web3.eth.getBalance(userThree) - sallerBalanceBefore)),
        "nft eth balance should be 0 and it's : ",
        fromWei(String(await web3.eth.getBalance(nft.address)))
      )
    })

    it('User can not buy the same nftire twice', async function() {
      await nft.createNewFor(userThree, 0, { from:userOne })

      const platformBalanceBefore = await web3.eth.getBalance(platformAddress)
      const sallerBalanceBefore = await web3.eth.getBalance(userThree)

      await nft.offerForSale(0, toWei("1"), { from:userThree })
      await nft.buy(0, { from:userTwo, value:toWei("1") })
      await nft.buy(0, { from:userTwo, value:toWei("1") })
      .should.be.rejectedWith(EVMRevert)
    })
  })
  //END
})
