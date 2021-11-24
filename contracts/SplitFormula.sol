import "@openzeppelin/contracts/math/SafeMath.sol";

contract SplitFormula {
  using SafeMath for uint256;

  uint256 public dexSplit = 80;
  uint256 public saleSplit = 20;

  function calculateToSplit(uint256 ethInput)
    public
    view
    returns(uint256 ethTodex, uint256 ethToSale)
  {
    ethTodex = ethInput.div(100).mul(dexSplit);
    ethToSale = ethInput.div(100).mul(saleSplit);
  }
}
