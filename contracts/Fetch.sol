pragma solidity ^0.6.2;

import "./interfaces/IUniswapV2Router02.sol";
import "./interfaces/IWETH.sol";
import "./interfaces/IStake.sol";
import "./interfaces/ISale.sol";
import "./interfaces/IWTOKEN.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract Fetch is Ownable {

  using SafeERC20 for IERC20;
  using SafeMath for uint256;
  address public WETH;
  address public dexRouter;
  address public tokenSale;
  IWTOKEN public WTOKEN;

  address public stakeAddress;

  address public token;

  uint256 public dexSplit = 80;
  uint256 public saleSplit = 20;

  uint256 public burnPercent = 10;

  bool public isBurnable = false;

  /**
  * @dev constructor
  *
  * @param _WETH                  address of Wrapped Ethereum token
  * @param _dexRouter             address of Corader DEX
  * @param _stakeAddress          address of claim able stake
  * @param _token                 address of token token
  * @param _tokenSale             address of sale
  * @param _WTOKEN                address of wtoken
  */
  constructor(
    address _WETH,
    address _dexRouter,
    address _stakeAddress,
    address _token,
    address _tokenSale,
    address _WTOKEN
    )
    public
  {
    WETH = _WETH;
    dexRouter = _dexRouter;
    stakeAddress = _stakeAddress;
    token = _token;
    tokenSale = _tokenSale;
    WTOKEN = IWTOKEN(_WTOKEN);
  }

  // deposit only ETH
  function deposit() external payable {
    require(msg.value > 0, "zerro eth");
    // swap ETH
    swapETHInput(msg.value);
    // deposit and stake
    _depositFor(msg.sender);
  }

  // deposit only ETH for a certain address
  function depositFor(address receiver) external payable {
    require(msg.value > 0, "zerro eth");
    // swap ETH
    swapETHInput(msg.value);
    // deposit and stake
    _depositFor(receiver);
  }

  // deposit only token
  function depositToken(uint256 tokenAmount) external {
    IERC20(token).safeTransferFrom(msg.sender, address(this), tokenAmount);
    // deposit and stake
    _depositFor(msg.sender);
  }

  /**
  * @dev convert deposited ETH into wtoken and then stake
  */
  function _depositFor(address receiver) internal {
    // check if token received
    uint256 tokenReceived = IERC20(token).balanceOf(address(this));
    require(tokenReceived > 0, "ZERRO TOKEN AMOUNT");

    // swap token to wtoken
    IERC20(token).approve(address(WTOKEN), tokenReceived);
    WTOKEN.deposit(tokenReceived);

    // approve wtoken to stake
    uint256 wtokenReceived = IERC20(address(WTOKEN)).balanceOf(address(this));
    require(wtokenReceived == tokenReceived, "Wrong WTOKEN amount");

    IERC20(address(WTOKEN)).approve(stakeAddress, wtokenReceived);

    if(isBurnable){
      // burn percent
      uint256 burnWtoken = wtokenReceived.div(100).mul(burnPercent);
      uint256 sendToWtoken = wtokenReceived.sub(burnWtoken);
      IERC20(address(WTOKEN)).transfer(address(0x000000000000000000000000000000000000dEaD), burnWtoken);
      // deposit received Wtoken in token vault strategy
      IStake(stakeAddress).stakeFor(sendToWtoken, receiver);
    }else{
      IStake(stakeAddress).stakeFor(wtokenReceived, receiver);
    }

    // send remains and shares back to users
    sendRemains(receiver);
  }


 /**
 * @dev send remains back to user
 */
 function sendRemains(address receiver) internal {
    uint256 tokenRemains = IERC20(token).balanceOf(address(this));
    if(tokenRemains > 0)
       IERC20(token).transfer(receiver, tokenRemains);

    uint256 ethRemains = address(this).balance;
    if(ethRemains > 0)
       payable(receiver).transfer(ethRemains);
 }

 /**
 * @dev swap ETH to token via DEX and Sale
 */
 function swapETHInput(uint256 input) internal {
  (uint256 ethTodex,
   uint256 ethToSale) = calculateToSplit(input);

  // SPLIT SALE with dex and Sale
  if(ethTodex > 0)
    swapETHViaDEX(dexRouter, ethTodex);

  if(ethToSale > 0)
    ISale(tokenSale).buy.value(ethToSale)();
 }

 // helper for swap via dex
 function swapETHViaDEX(address routerDEX, uint256 amount) internal {
   // SWAP split % of ETH input to token from Wtoken
   address[] memory path = new address[](2);
   path[0] = WETH;
   path[1] = token;

   IUniswapV2Router02(routerDEX).swapExactETHForTokens.value(amount)(
     1,
     path,
     address(this),
     now + 1800
   );
 }

 /**
 * @dev return split % amount of input
 */
 function calculateToSplit(uint256 ethInput)
   public
   view
   returns(uint256 ethTodex, uint256 ethToSale)
 {
   ethTodex = ethInput.div(100).mul(dexSplit);
   ethToSale = ethInput.div(100).mul(saleSplit);
 }

 /**
 * @dev allow owner set new split
 */
 function updateSplit(
   uint256 _dexSplit,
   uint256 _saleSplit
 )
   external
   onlyOwner
 {
   uint256 totalPercentage = _dexSplit + _saleSplit;
   require(totalPercentage == 100, "wrong total split");

   dexSplit = _dexSplit;
   saleSplit = _saleSplit;
 }

 /**
 * @dev allow owner set new stakeAddress contract address
 */
 function changeStakeAddress(address _stakeAddress) external onlyOwner {
   stakeAddress = _stakeAddress;
 }

 /**
 * @dev allow owner set burn percent
 */
 function updateBurnPercent(uint256 _burnPercent) external onlyOwner {
   require(_burnPercent > 0, "min %");
   require(_burnPercent <= 10, "max %");
   burnPercent = _burnPercent;
 }

 /**
 * @dev allow owner enable/disable burn
 */
 function updateBurnStatus(bool _status) external onlyOwner {
   isBurnable = _status;
 }
}
