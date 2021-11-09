# Description
```
0) SafeMoon based token.

1) Only Stake contract can mint new NFT.

2) User can get NFT in 2 ways. Via get stake rewards, one time per address (proof of stake) or just buy from stake via ETH(BNB or MATIC dependse on chain).

3) SF token with ExcludedFromTransferLimit for manage stake limit and allow stake transfer to user more than max limit. for case if user gained more than max limit in stake duration.

4) Burn % of pool share in fetch deposits.

5) Enable/disable burn in fetch.

6) Fetch with split 20% SALE and 80% DEX (can be changed).
```


# if Router-Hash-test failed
```
Make sure You updated PairHash in config.js and test/contracts/dex/libraries/UniswapV2Library.sol
```
