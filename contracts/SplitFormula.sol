/**
1 If (LD below $100K) 50%
2 If (LD below $10K) 25%
3 If (LD below $1K) 0%
4 If (price below 1000x) 100%
*/

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IUniswapV2Router02.sol";

contract SplitFormula {
  using SafeMath for uint256;

  IUniswapV2Router02 public Router;
  address public token;
  address public poolPair;
  address public weth;
  address public DAI;

  uint256 public initialRate;
  uint256 public minLDAmountInDAI;
  uint256 public maxLDAmountInDAI;

  constructor(
    uint256 _initialRate,
    uint256 _minLDAmountInDAI,
    uint256 _maxLDAmountInDAI,
    address _dexRouter,
    address _poolPair,
    address _token,
    address _DAI
  )
    public
  {
    initialRate = _initialRate;
    minLDAmountInDAI = _minLDAmountInDAI;
    maxLDAmountInDAI = _maxLDAmountInDAI;
    Router = IUniswapV2Router02(_dexRouter);
    poolPair = _poolPair;
    token = _token;
    weth = Router.WETH();
    DAI = _DAI;
  }

  function calculateToSplit(uint256 ethInput)
    public
    view
    returns(uint256 ethPercentTodex, uint256 ethPercentToSale)
  {
    if(getCurrentPrice() >= initialRate.mul(1000)){
      ethPercentTodex = 0;
      ethPercentToSale = 1000;
    }
    else{
     (ethPercentTodex, ethPercentToSale) = calculatePercentToSplit(ethInput);
    }
  }


  function calculatePercentToSplit(uint256 ethInput)
    public
    view
    returns(uint256 ethPercentTodex, uint256 ethPercentToSale)
  {
    uint256 LDAmount = getLDAmountInDAI();

    if(LDAmount >= maxLDAmountInDAI){
      ethPercentTodex = 50;
      ethPercentToSale = 50;
    }
    if(LDAmount >= minLDAmountInDAI){
      ethPercentTodex = 50;
      ethPercentToSale = 50;
    }
    else{
      ethPercentTodex = 50;
      ethPercentToSale = 50;
    }
  }

  function getLDAmountInDAI() public view returns(uint256){
    uint256 wethBalance = IERC20(weth).balanceOf(poolPair);
    address[] memory path = new address[](2);
    path[0] = DAI;
    path[1] = weth;
    uint256[] memory res = Router.getAmountsOut(wethBalance, path);
    return res[1];
  }

  function getCurrentPrice() public view returns(uint256){
    address[] memory path = new address[](2);
    path[0] = address(token);
    path[1] = weth;
    uint256[] memory res = Router.getAmountsOut(1000000000, path);
    return res[1];
  }
}
