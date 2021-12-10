// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./NFT.sol";


contract Market is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;
    Counters.Counter private _itemIds;
    Counters.Counter private _itemsSold;
  
    NFT private nftContract;
    IERC20 public payToken;
    address payable owner;

    constructor(address payable _owner, IERC20 _paymentToken) {
        owner = _owner;
        payToken = _paymentToken;
    }

    struct MarketItem {
        uint itemId;
        uint256 tokenId;
        address payable seller;
        address payable owner;
        uint256 pricePayToken;
        bool sold;
    }

    mapping(uint256 => bool) private tokenIdToSold;
    mapping(uint256 => MarketItem) private tokenIdToMarketItem;

    event TicketSold(
        uint256 indexed tokenId,
        address buyer,
        uint256 price
    );

    event MarketItemCreated (
        uint256 indexed itemId,
        uint256 indexed tokenId,
        address seller,
        address owner,
        uint256 pricePayToken,
        bool sold
    );

    event MarketItemSold (
        uint256 indexed itemId,
        uint256 indexed tokenId,
        address seller,
        address owner,
        uint256 amount,
        bool sold
    ); 

    event MarketItemCanceled(uint256 itemId, uint256 tokenId, address seller);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
  
    modifier onlyOwner() {
        require(msg.sender == owner, "Ownable: caller is not the owner");
        _;
    }
    
    function getNftContract() view external onlyOwner returns (NFT) {
        return nftContract;
    }
    
    function setNftContract(address _nftContract) external onlyOwner {
        nftContract = NFT(_nftContract);
    }

    /* Returns the listing price of the market item */
    function getItemPrice(uint256 itemId) external view returns (uint256) {
        return (tokenIdToMarketItem[itemId].pricePayToken);
    }
 
    /* Change price for the market item */
    function setItemPrice(uint256 itemId, uint256 pricePayToken) external onlyOwner {
        tokenIdToMarketItem[itemId].pricePayToken = pricePayToken;
    }

    function getMarketItem(uint256 _itemId) view external onlyOwner returns (
        uint256, uint256, address, address, uint256, bool) {
        MarketItem storage item = tokenIdToMarketItem[_itemId];
        return (
            item.itemId,
            item.tokenId,
            item.seller,
            item.owner,
            item.pricePayToken,
            item.sold
        );
    }

    function _getNftInitialPrice(uint256 _tokenId) view internal returns (uint256) {
        // DSNFT contract = DSNFT(nftContract);
        uint256 initialPrice = nftContract.getTicketInitialPrice(_tokenId);
        return initialPrice;
    }  

    function getInitialSoldTicket(uint256 tokenId) view external returns (bool) {
        return tokenIdToSold[tokenId];
    }

    /* Create initial ticket sale */
    function initialTicketSale(
        uint256 tokenId,
        uint256 amount 
    ) external nonReentrant returns (bool) {
        bool tokenSold = tokenIdToSold[tokenId];
        uint256 initialPrice = _getNftInitialPrice(tokenId);
        require(!tokenSold, "Marketplace: This tokenId is already sold from initial ticket sale");
        require(amount >= initialPrice, "Marketplace: Please submit the asking price in order to complete the purchase");

        IERC20(payToken).safeTransferFrom(msg.sender, address(0x000000000000000000000000000000000000dEaD), amount);
        IERC721(nftContract).safeTransferFrom(owner, msg.sender, tokenId);
        tokenIdToSold[tokenId] = true;
    
        emit TicketSold(tokenId, msg.sender, amount);
        return true;
    }

    /* Places an item for sale on the marketplace */
    function createMarketItem(
        uint256 tokenId,
        uint256 pricePayToken
    ) external nonReentrant {
        require(msg.sender == IERC721(nftContract).ownerOf(tokenId), "Marketplace: Should be the owner of token");
        require(IERC721(nftContract).getApproved(tokenId) == address(this), "Marketplace: Marketplace should be approved for transferring nft token");
        require(pricePayToken > 0, "Marketplace: Price must be at least 1 dbz");

        _itemIds.increment();
        uint256 itemId = _itemIds.current();
  
        tokenIdToMarketItem[itemId] =  MarketItem(
            itemId,
            tokenId,
            payable(msg.sender),
            payable(address(0)),
            pricePayToken,
            false
        );
    
        IERC721(nftContract).transferFrom(msg.sender, address(this), tokenId);

        emit MarketItemCreated(
            itemId,
            tokenId,
            msg.sender,
            address(0),
            pricePayToken,
            false
        );
      }

    /* Creates the sale of a marketplace item */
    /* Transfers ownership of the item, as well as funds between parties */
    function createMarketSale(
        uint256 itemId,
        uint256 amount
    ) external nonReentrant {
        uint256 pricePayToken = tokenIdToMarketItem[itemId].pricePayToken;
        uint256 tokenId = tokenIdToMarketItem[itemId].tokenId;
        address tokenOwner = tokenIdToMarketItem[itemId].owner;
    
        require(amount >= pricePayToken, "Marketplace: Please submit the asking price in order to complete the purchase");
        
        IERC20(payToken).safeTransferFrom(msg.sender, tokenIdToMarketItem[itemId].seller, amount);
        IERC721(nftContract).safeTransferFrom(address(this), msg.sender, tokenId);
        tokenIdToMarketItem[itemId].owner = payable(msg.sender);
        tokenIdToMarketItem[itemId].sold = true;
        _itemsSold.increment();

        emit MarketItemSold(
            itemId,
            tokenId,
            tokenOwner,
            msg.sender,
            amount,
            true
        );
    }

    /* Remove item from market */
    function cancelMarketItem(uint256 itemId) external nonReentrant {
        address marketItemCreator = tokenIdToMarketItem[itemId].seller;
        uint256 tokenId = tokenIdToMarketItem[itemId].tokenId;
        bool unsold = tokenIdToMarketItem[itemId].sold;
        require(unsold == false, "Marketplace: Market item is already sold");

        if (msg.sender == marketItemCreator) {
            IERC721(nftContract).safeTransferFrom(address(this), msg.sender, tokenId);
        } else if (msg.sender == owner) {
            IERC721(nftContract).safeTransferFrom(address(this), marketItemCreator, tokenId);
        } else {
            revert("DSMarketplace: Market item can be cancelled by token seller or admin");
        }

        emit MarketItemCanceled(itemId, tokenId, marketItemCreator);
        delete tokenIdToMarketItem[itemId];
    }
    
    /* Returns all unsold market items */
    function fetchUnsoldMarketItems() external view returns (MarketItem[] memory) {
        uint itemCount = _itemIds.current();
        uint unsoldItemCount = _itemIds.current() - _itemsSold.current();
        uint currentIndex = 0;

        MarketItem[] memory items = new MarketItem[](unsoldItemCount);
            for (uint i = 0; i < itemCount; i++) {
                if (tokenIdToMarketItem[i + 1].owner == address(0)) {
                    uint currentId = i + 1;
                    MarketItem storage currentItem = tokenIdToMarketItem[currentId];
                    items[currentIndex] = currentItem;
                    currentIndex += 1;
                }
            }
        return items;
    }

    /* Returns only items that a user has purchased */
    function fetchPurchasedNFTs() external view returns (MarketItem[] memory) {
        uint totalItemCount = _itemIds.current();
        uint itemCount = 0;
        uint currentIndex = 0;

        for (uint i = 0; i < totalItemCount; i++) {
            if (tokenIdToMarketItem[i + 1].owner == msg.sender) {
            itemCount += 1;
            }
        }

        MarketItem[] memory items = new MarketItem[](itemCount);
            for (uint i = 0; i < totalItemCount; i++) {
                if (tokenIdToMarketItem[i + 1].owner == msg.sender) {
                    uint currentId = i + 1;
                    MarketItem storage currentItem = tokenIdToMarketItem[currentId];
                    items[currentIndex] = currentItem;
                    currentIndex += 1;
                }
            }
        return items;
    }

    /* Returns only items a user has created */
    function fetchItemsCreated() external view returns (MarketItem[] memory) {
        uint totalItemCount = _itemIds.current();
        uint itemCount = 0;
        uint currentIndex = 0;

        for (uint i = 0; i < totalItemCount; i++) {
            if (tokenIdToMarketItem[i + 1].seller == msg.sender) {
            itemCount += 1;
            }
        }

        MarketItem[] memory items = new MarketItem[](itemCount);
        for (uint i = 0; i < totalItemCount; i++) {
            if (tokenIdToMarketItem[i + 1].seller == msg.sender) {
                uint currentId = i + 1;
                MarketItem storage currentItem = tokenIdToMarketItem[currentId];
                items[currentIndex] = currentItem;
                currentIndex += 1;
            }
        }
    return items;
    }
    
    /**
     * Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address payable newOwner) external onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        _transferOwnership(newOwner);
    }

    /**
     * Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address payable newOwner) internal {
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

}