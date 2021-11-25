import "./interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract LDManager {
  IUniswapV2Router02 public Router;
  address public token;

  constructor(address _Router, address _token) public {
      Router = IUniswapV2Router02(_Router);
      token = _token;
  }

  function addLiquidity() external payable {
      uint256 tokenAmount = getTokenPrice(msg.value);
      // approve token transfer to cover all possible scenarios
      IERC20(token).approve(address(Router), tokenAmount);
      // add the liquidity
      Router.addLiquidityETH{value: msg.value}(
          token,
          tokenAmount,
          0, // slippage is unavoidable
          0, // slippage is unavoidable
          address(0x000000000000000000000000000000000000dEaD),
          block.timestamp
      );
  }


  function getTokenPrice(uint256 _ethAmount) public view returns(uint256) {
      address[] memory path = new address[](2);
      path[0] = address(token);
      path[1] = Router.WETH();
      uint256[] memory res = Router.getAmountsOut(_ethAmount, path);
      return res[1];
  }

  receive() external payable {}
}
