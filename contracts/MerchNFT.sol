// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


contract DSMerchNFT is ERC721URIStorage, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    IERC20 public payToken;
    uint256 private initPrice;
    bool private _paused = true;

    mapping(uint256 => bool) private tokenIdToSold;
    
    event TokenCreated(uint256 indexed tokenId, address tokenCreator);
    event TokenBurned(uint256 indexed tokenId, address tokenContractOwner);
    event TokenURIChanged(uint256 tokenId, string newTokenURI);
    event TokenSold(uint256 indexed tokenId, address buyer);
    event Paused(address account, uint256 timestamp);
    event Unpaused(address account, uint256 timestamp);
    event SetInitialPrice(uint256 initPrice);
    
    constructor(address _paymentToken) ERC721("Merch NFT", "NFT") {
        payToken = IERC20(_paymentToken);
    }
    
    function createToken(
        uint256 numberOfTokens,
        string calldata tokenURI
    ) external onlyOwner {
        require(numberOfTokens <= 50, "NFT: number of tokens should be less or equal 50 items by one call");
        require(numberOfTokens > 0, "NFT: number of tokens should not be zero");

        for (uint256 i = 0; i < numberOfTokens; i++) {
            _tokenIds.increment();
            uint256 newItemId = _tokenIds.current();
            _safeMint(owner(), newItemId);
            _setTokenURI(newItemId, tokenURI);
    
            emit TokenCreated(newItemId, owner());
        }
        
        setApprovalForAll(address(this), true);
    }
    
    function burnToken(uint256 tokenId) external onlyOwner {
        require(_isApprovedOrOwner(_msgSender(), tokenId), "NFT: caller is not owner nor approved");
        _burn(tokenId);
        emit TokenBurned(tokenId, msg.sender);
    }

    function setTokenURI(uint256 tokenId, string calldata _newTokenURI) external onlyOwner {
        _setTokenURI(tokenId, _newTokenURI);
        emit TokenURIChanged(tokenId, _newTokenURI);
    }

    /* Create initial ticket sale */
    function initialTicketSale(
        uint256 tokenId,
        uint256 amount 
    ) public nonReentrant whenNotPaused returns (bool) {
        require(!tokenIdToSold[tokenId], "NFT: This tokenId is already sold from initial ticket sale");
        require(getInitialPrice() > 0, "NFT: Initial price should be more then zero");
        require(amount >= getInitialPrice(), "NFT: Please submit the asking price in order to complete the purchase");
        require(IERC20(payToken).allowance(_msgSender(), address(this)) == amount, "NFT: marketplace should be approved as a spender");

        IERC20(payToken).safeTransferFrom(_msgSender(), owner(), amount);
        IERC721(address(this)).safeTransferFrom(owner(), _msgSender(), tokenId);
        tokenIdToSold[tokenId] = true;
    
        emit TokenSold(tokenId, _msgSender());
        return true;
    }

    function getInitialPrice() view public returns (uint256) {
        return initPrice;
    }

    function setInitialPrice(uint256 _initPrice) external onlyOwner {
        initPrice = _initPrice;
        emit SetInitialPrice(initPrice);
    }

    modifier whenNotPaused() {
        require(!paused(), "NFT: sale is not started yet or token minting is paused");
        _;
    }

    modifier whenPaused() {
        require(paused(), "NFT: sale is already started or token minting is not paused");
        _;
    }
    
    function _pause() public onlyOwner whenNotPaused {
        _paused = true;
        emit Paused(_msgSender(), block.timestamp);
    }

    function _unpause() public onlyOwner whenPaused {
        _paused = false;
        emit Unpaused(_msgSender(), block.timestamp);
    }

    function paused() public view returns (bool) {
        return _paused;
    }
}