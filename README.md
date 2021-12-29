# Description
```
NFTs with stake (for case if we will want this)

1) Only Stake contract can mint new NFT.

2) User can get NFT in 2 ways. Via get stake rewards, one time per address (proof of stake) or just buy from stake via ETH(BNB or MATIC dependse on chain).


Stake/Fetch/Sale

1) Cut % of pool share (or WTOKEN) in fetch deposits.

2) Enable/disable cut in fetch

3) Change able commision for cut in from 1% to 5%

4) Fetch with split SALE and DEX (can be changed in splitFormula).

5) White list for sale and stake (users can not use sale or stake directly)

6) antiDumpingDelay in stake (users can not claim a certain period)

7) Split sale with LDManager (LD manager add LD with ETH and Tokens on his own balance and then burn pool shares)

8) Add finish (burn remains tokens) in sale and LD manager

9) Add migrate() to sale and LDmanager and vice versa, or to new versions of sale or LD manager

10) Remove withdarw unused from sale

11) Remove inCaseRewardsStuck in stake

12) Add convertFor for case deposit without stake

13) Add isAllowDeposit


Safemoon token

3) We have SF based based token, we only add ExcludedFromTransferLimit for manage stake limit and allow stake transfer to user more than max limit.

For case if user gained more than max limit transfer in stake duration.

```


# if Router-Hash-test failed
```
Make sure You updated PairHash in config.js and test/contracts/dex/libraries/UniswapV2Library.sol
```
