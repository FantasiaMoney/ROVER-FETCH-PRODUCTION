import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IUniswapV2Router02.sol";

contract SplitFormula {
  using SafeMath for uint256;

  IUniswapV2Router02 public Router;
  address public token;
  address public poolPair;
  address public weth;

  uint256 public initialRate;
  uint256 public minLDAmount;

  constructor(
    uint256 _initialRate,
    uint256 _minLDAmount,
    address _dexRouter,
    address _poolPair,
    address _token
  )
    public
  {
    initialRate = _initialRate;
    minLDAmount = _minLDAmount;
    Router = IUniswapV2Router02(_dexRouter);
    poolPair = _poolPair;
    token = _token;
    weth = Router.WETH();
  }

  function calculateToSplit(uint256 ethInput)
    public
    view
    returns(uint256 ethPercentTodex, uint256 ethPercentToSale)
  {
    if(getCurrentPrice() < initialRate){
      ethPercentTodex = 100;
      ethPercentToSale = 0;
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
    if(getLDAmount() > minLDAmount){
      ethPercentTodex = 50;
      ethPercentToSale = 50;
    }
    else{
      ethPercentTodex = 80;
      ethPercentToSale = 20;
    }
  }

  function getLDAmount() public view returns(uint256){
    return IERC20(weth).balanceOf(poolPair);
  }

  function getCurrentPrice() public view returns(uint256){
    address[] memory path = new address[](2);
    path[0] = address(token);
    path[1] = weth;
    uint256[] memory res = Router.getAmountsOut(1000000000, path);
    return res[1];
  }
}
