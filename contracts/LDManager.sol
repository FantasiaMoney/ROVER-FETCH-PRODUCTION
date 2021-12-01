import "./interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LDManager is Ownable {
  IUniswapV2Router02 public Router;
  address public token;
  bool public endMigrate = false;

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
      path[0] = Router.WETH();
      path[1] = address(token);
      uint256[] memory res = Router.getAmountsOut(_ethAmount, path);
      return res[1];
  }

  /**
  * @dev owner can block migrate forever
  */
  function blockMigrate() external onlyOwner {
    endMigrate = true;
  }

  /**
  * @dev owner can move assets to another sale address or LD manager
  */
  function migrate(address _to, uint256 _amount) external onlyOwner {
     require(!endMigrate, "Migrate finished");
     IERC20(token).transfer(_to, _amount);
  }

  /**
  * @dev owner can move assets to burn
  */
  function finish() external onlyOwner {
     IERC20(token).transfer(
       address(0x000000000000000000000000000000000000dEaD),
       IERC20(token).balanceOf(address(this))
     );
  }

  receive() external payable {}
}
