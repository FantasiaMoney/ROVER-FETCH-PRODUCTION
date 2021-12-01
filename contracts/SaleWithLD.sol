pragma solidity ^0.6.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./interfaces/IUniswapV2Router02.sol";
import "./interfaces/ILDManager.sol";
import "./interfaces/IOwnable.sol";


contract SaleWithLD is Ownable {
  using SafeMath for uint256;
  address payable public beneficiary;
  IERC20  public token;
  bool public paused = false;
  IUniswapV2Router02 public Router;
  ILDManager public LDManager;
  bool public sellEnd = false;
  bool public enabledLDSplit = true;
  bool public endMigrate = false;

  mapping(address => bool) public whiteList;

  event Buy(address indexed user, uint256 amount);

  /**
  * @dev constructor
  *
  * @param _token         token address
  * @param _beneficiary   Address for receive ETH
  * @param _router        Uniswap v2 router
  */
  constructor(
    address _token,
    address payable _beneficiary,
    address _router,
    address _LDManager
    )
    public
  {
    token = IERC20(_token);
    beneficiary = _beneficiary;
    Router = IUniswapV2Router02(_router);
    LDManager = ILDManager(_LDManager);
  }

  /**
  * @dev user can buy token via ETH
  *
  */
  function buy() public payable {
    // allow buy only for white list
    require(whiteList[msg.sender], "Not in white list");
    // not allow buy if sale end
    require(!sellEnd, "Sale end");
    // not allow buy if paused
    require(!paused, "Paused");
    // not allow buy 0
    require(msg.value > 0, "Zerro input");
    // calculate amount of token to send
    uint256 sendAmount = getSalePrice(msg.value);
    // check if enough balance
    require(token.balanceOf(address(this)) >= sendAmount, "Not enough balance");
    // split ETH with LD manager
    if(enabledLDSplit){
      uint256 halfETH = msg.value.div(2);
      beneficiary.transfer(halfETH);
      LDManager.addLiquidity{value: halfETH}();
    }else{
      beneficiary.transfer(msg.value);
    }
    // transfer token to user
    token.transfer(msg.sender, sendAmount);
    // event
    emit Buy(msg.sender, sendAmount);
  }

  /**
  * @dev return sale price from pool
  */
  function getSalePrice(uint256 _amount) public view returns(uint256) {
    address[] memory path = new address[](2);
    path[0] = Router.WETH();
    path[1] = address(token);
    uint256[] memory res = Router.getAmountsOut(_amount, path);
    return res[1];
  }

  /**
  * @dev called by the owner to pause, triggers stopped state
  */
  function pause() onlyOwner external {
    paused = true;
  }

  /**
  * @dev called by the owner to unpause, returns to normal state
  */
  function unpause() onlyOwner external {
    paused = false;
  }

  /**
  * @dev owner can update beneficiary
  */
  function updateBeneficiary(address payable _beneficiary) external onlyOwner {
    beneficiary = _beneficiary;
  }

  /**
  * @dev owner can update white list
  */
  function updateWhiteList(address _address, bool _status) external onlyOwner {
    whiteList[_address] = _status;
  }


  /**
  * @dev owner can update enabled LD split
  */
  function updateEnabledLDSplit(bool _status) external onlyOwner {
    enabledLDSplit = _status;
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
     token.transfer(_to, _amount);
  }

  /**
  * @dev owner can move assets to burn
  */
  function finish() external onlyOwner {
     token.transfer(
       address(0x000000000000000000000000000000000000dEaD),
       token.balanceOf(address(this))
     );
  }

  /**
   * @dev fallback function
   */
  receive() external payable  {
    buy();
  }
}
