// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


contract Marketplace is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;
    Counters.Counter private _itemIds;
    Counters.Counter private _itemsSold;

    enum Currency { ART, BNB }
    Currency private currency;

    struct MarketItem {
        uint256 itemId;
        address tokenContract;
        uint256 tokenId;
        address payable seller;
        address payable owner;
        uint256 priceART;
        uint256 priceBNB;
        bool sold;
    }

    mapping(uint256 => MarketItem) private tokenIdToMarketItem;
    mapping(address => mapping(uint256 => uint256)) private tokenContractToMarketItemId;

    IERC20 private payToken;
    bytes4 private constant INTERFACE_ID_ERC721 = 0x80ac58cd; // 721 interface id

    uint16 public platformFee;
    address payable public feeRecipient;

    event MarketItemCreated (
        uint256 indexed itemId,
        address indexed tokenContract,
        uint256 indexed tokenId,
        address seller,
        address owner,
        uint256 priceART,
        uint256 priceBNB,
        bool sold
    );

    event MarketItemSold (
        uint256 indexed itemId,
        address indexed tokenContract,
        uint256 indexed tokenId,
        Currency currency,
        address seller,
        address owner,
        uint256 amount,
        bool sold
    ); 

    event MarketItemPriceUpdated(uint256 itemId, uint256 newPriceDBZ, uint256 newPriceBNB);
    event MarketItemCanceled(uint256 itemId, uint256 tokenId, address seller);
    event UpdatePlatformFee(uint16 platformFee);
    event UpdatePlatformFeeRecipient(address platformFeeRecipient);

    constructor(){}

    function getPaymentToken() view public returns (IERC20) {
        return payToken;
    }

    function setPaymentToken(address _paymentToken) external onlyOwner {
        payToken = IERC20(_paymentToken);
    }

    function getItemPrice(uint256 _itemId) external view returns (uint256, uint256) {
        return (tokenIdToMarketItem[_itemId].priceART, tokenIdToMarketItem[_itemId].priceBNB);
    }
 
    function updateItemPrice(uint256 _itemId, uint256 _newPriceART, uint256 _newPriceBNB) external {
        address tokenSeller = tokenIdToMarketItem[_itemId].seller;
        require(msg.sender == tokenSeller, "Market: should be token seller");
        MarketItem storage item = tokenIdToMarketItem[_itemId];
        item.priceART = _newPriceART;
        item.priceBNB = _newPriceBNB;

        emit MarketItemPriceUpdated(_itemId, _newPriceART, _newPriceBNB);
    }

    function getMarketItem(uint256 _itemId) view external returns (
        uint256, address, uint256, address, address, uint256, uint256, bool) {
        MarketItem storage item = tokenIdToMarketItem[_itemId];
        return (
            item.itemId,
            item.tokenContract,
            item.tokenId,
            item.seller,
            item.owner,
            item.priceART,
            item.priceBNB,
            item.sold
        );
    }

    function createMarketItem(
        address _tokenContract,
        uint256 _tokenId,
        uint256 _priceART,
        uint256 _priceBNB
    ) external nonReentrant {
        require(
            IERC165(_tokenContract).supportsInterface(INTERFACE_ID_ERC721),
            "Market: token contract does not support ERC721 interface"
        );
        require(
            msg.sender == IERC721(_tokenContract).ownerOf(_tokenId) ||
            msg.sender == IERC721(_tokenContract).getApproved(_tokenId), 
            "Market: should be the token owner or approved"
        );
        require(
            IERC721(_tokenContract).getApproved(_tokenId) == address(this), 
            "Market: marketplace should be approved for transferring NFT token"
        );
        require(_priceART > 0 || _priceBNB > 0, "Market: price must be greater than zero");

        _itemIds.increment();
        uint256 _itemId = _itemIds.current();
  
        tokenIdToMarketItem[_itemId] =  MarketItem(
            _itemId,
            _tokenContract,
            _tokenId,
            payable(msg.sender),
            payable(address(0)),
            _priceART,
            _priceBNB,
            false
        );

        tokenContractToMarketItemId[_tokenContract][_tokenId] = _itemId;
    
        IERC721(_tokenContract).transferFrom(msg.sender, address(this), _tokenId);

        emit MarketItemCreated(
            _itemId,
            _tokenContract,
            _tokenId,
            msg.sender,
            address(0),
            _priceART,
            _priceBNB,
            false
        );
    }

    function getMarketItemId(address _tokenContract, uint256 _tokenId) view external returns (uint256) {
        uint256 itemId = tokenContractToMarketItemId[_tokenContract][_tokenId];
        return itemId;
    }

    function createMarketSale(
        // address _paymentToken,
        uint256 _itemId,
        uint256 _amount
    ) external payable nonReentrant {
        address tokenContract = tokenIdToMarketItem[_itemId].tokenContract;
        address tokenOwner = tokenIdToMarketItem[_itemId].owner;
        address tokenSeller = tokenIdToMarketItem[_itemId].seller;
        uint256 tokenId = tokenIdToMarketItem[_itemId].tokenId;
        uint256 priceART = tokenIdToMarketItem[_itemId].priceART;
        uint256 priceBNB = tokenIdToMarketItem[_itemId].priceBNB;
        uint256 feeAmount;

        if (_amount != 0) {
        // if (IERC20(_paymentToken) == payToken) {
            require(priceART != 0, "Market: market token price can not be zero");
            require(_amount >= priceART, "Market: please submit the asking price in order to complete the purchase");
            require(IERC20(payToken).allowance(msg.sender, address(this)) == _amount, "Market: marketplace should be approved as a spender");
            
            if (platformFee > 0) {
                feeAmount = _platformPayment(priceART);
                IERC20(payToken).safeTransferFrom(msg.sender, payable(feeRecipient), feeAmount);
            }
            
            IERC20(payToken).safeTransferFrom(msg.sender, tokenSeller, _amount - feeAmount);
            IERC721(tokenContract).safeTransferFrom(address(this), msg.sender, tokenId);
            tokenIdToMarketItem[_itemId].owner = payable(msg.sender);
            tokenIdToMarketItem[_itemId].sold = true;
            _itemsSold.increment();

            emit MarketItemSold(
                _itemId,
                tokenContract,
                tokenId,
                Currency.ART,
                tokenOwner,
                msg.sender,
                _amount,
                true
            );
        } 
        else if (_amount == 0) {
        // else if (_paymentToken == address(0)) {
            require(priceBNB != 0, "Market: market token price can not be zero");
            require(msg.value >= priceBNB, "Market: please submit the asking price in order to complete the purchase");

            if (platformFee > 0) {
                feeAmount = _platformPayment(priceBNB);
                payable(feeRecipient).transfer(feeAmount);
            }

            payable(tokenSeller).transfer(priceBNB - feeAmount);
            IERC721(tokenContract).safeTransferFrom(address(this), msg.sender, tokenId);
            tokenIdToMarketItem[_itemId].owner = payable(msg.sender);
            tokenIdToMarketItem[_itemId].sold = true;
            _itemsSold.increment();

            emit MarketItemSold(
                _itemId,
                tokenContract,
                tokenId,
                Currency.BNB,
                tokenOwner,
                msg.sender,
                msg.value,
                true
            );
        }
        else {
            revert("Market: not supported payment token");
        }
    }

    function cancelMarketItem(uint256 _itemId) external nonReentrant {
        address tokenContract = tokenIdToMarketItem[_itemId].tokenContract;
        address marketItemCreator = tokenIdToMarketItem[_itemId].seller;
        uint256 tokenId = tokenIdToMarketItem[_itemId].tokenId;
        bool unsold = tokenIdToMarketItem[_itemId].sold;
        require(unsold == false, "Market: market item is already sold");

        if (msg.sender == marketItemCreator) {
            IERC721(tokenContract).safeTransferFrom(address(this), msg.sender, tokenId);
        } else if (msg.sender == owner()) {
            IERC721(tokenContract).safeTransferFrom(address(this), marketItemCreator, tokenId);
        } else {
            revert("Market: market item can be cancelled by token seller or admin");
        }

        emit MarketItemCanceled(_itemId, tokenId, marketItemCreator);
        delete tokenIdToMarketItem[_itemId];
    }

    function updatePlatformFee(uint16 _platformFee) external onlyOwner {
        platformFee = _platformFee;
        emit UpdatePlatformFee(_platformFee);
    }

    function updatePlatformFeeRecipient(address payable _platformFeeRecipient) external onlyOwner {
        feeRecipient = _platformFeeRecipient;
        emit UpdatePlatformFeeRecipient(_platformFeeRecipient);
    }

    function _platformPayment(uint256 _price) view internal returns (uint256) {
        return (_price * platformFee) / (1e4);
    }

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

}