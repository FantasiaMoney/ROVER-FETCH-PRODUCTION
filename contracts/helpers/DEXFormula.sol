// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.2;


import '../dex/interfaces/IUniswapV2Router02.sol';
import '../dex/interfaces/IUniswapV2Pair.sol';
import '@openzeppelin/contracts/math/Math.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';


contract DEXFormula {
  using SafeMath for uint256;

  IUniswapV2Router02 public Router;

  constructor(address _Router) public {
    Router = IUniswapV2Router02(_Router);
  }

  function calculatePoolToMint(uint256 amount0, uint256 amount1, address pair)
    public
    view
    returns(uint256 liquidity)
  {
    (uint256 reserve0, uint256 reserve1, ) = IUniswapV2Pair(pair).getReserves();
    uint256 totalSupply = IUniswapV2Pair(pair).totalSupply();

    liquidity = Math.min(
      amount0.mul(totalSupply) / reserve0,
      amount1.mul(totalSupply) / reserve1
    );
  }

  function getPoolAmountByWant(uint256 _wantAmount, address pair, address want)
    public
    view
    returns(uint256 liquidity)
  {
     uint256 WETH_AMOUNT = routerRatio(want, Router.WETH(), _wantAmount);
     liquidity = calculatePoolToMint(WETH_AMOUNT, _wantAmount, pair);
  }

  function getWantAmountByPool(uint256 liquidity, address pair, address want)
    public
    view
    returns(uint256 wantAmount)
  {
    uint256 totalSupply = IUniswapV2Pair(pair).totalSupply();

    address tokenA = IUniswapV2Pair(pair).token0();
    address tokenB = IUniswapV2Pair(pair).token1();

    uint256 tokenA_amount = liquidity.mul(IERC20(tokenA).balanceOf(pair)).div(totalSupply);
    uint256 tokenB_amount = liquidity.mul(IERC20(tokenB).balanceOf(pair)).div(totalSupply);

    if(tokenA == want){
      uint256 toWant = routerRatio(tokenB, tokenA, tokenB_amount);
      wantAmount = tokenA_amount.add(toWant);
    }
    else if(tokenB == want){
      uint256 toWant = routerRatio(tokenA, tokenB, tokenA_amount);
      wantAmount = tokenB_amount.add(toWant);
    }
    else{
      revert("Wrong want token");
    }
  }

  // Get rate between 2 tokens directly
  function routerRatio(address from, address to, uint256 fromAmount) public view returns (uint256){
    address[] memory path = new address[](2);
    path[0] = from;
    path[1] = to;
    uint256[] memory res = Router.getAmountsOut(fromAmount, path);
    return res[1];
  }
}
