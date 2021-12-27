// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "hardhat/console.sol";


contract NFTAuction is ReentrancyGuard, ERC721Holder, Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 public payToken;

    enum AuctionStatus {
        Active,
        Cancelled,
        Completed
    }

    struct Auction {
        address payable seller; // Current owner of NFT
        address nftContract;   // NFT token SC address 
        uint256 tokenId;    // NFT token ID
        uint128 price;  // Token initial price  100000000000000000 wei = 0,1 eth
        uint256 duration;   // Block count for when the auction ends
        uint256 bidIncrement;   // Minimum bid increment (in Wei)  5000000000000000 wei = 0,005 eth
        uint256 startedAt;  // Approximate time for when the auction was started
        uint256 startBlock; // Block number when auction started
        uint256 highestBid; // Current highest bid
        address highestBidder;  // Address of current highest bidder
        mapping(address => uint256) fundsByBidder; // Mapping of addresses to funds
        bool cancelled; // Flag for cancelled auctions 
    }

    uint totalAuctions;
    Auction[] public auctions;

    constructor(/*address _paymentToken*/) {
        // payToken = IERC20(_paymentToken);
    }

    event AuctionCreated(uint auctionId, address nftContract, uint256 tokenId, address seller, uint256 initialPrice, uint256 duration, uint256 bidIncrement);
    event BidCreated(uint256 auctionId, address nftContract, uint256 tokenId, address bidder, uint256 bid);
    event AuctionNFTWithdrawal(uint256 _auctionId, address nftContract, uint256 tokenId, address buyerNFT);
    event ActionFundWithdrawal(uint256 _auctionId, address nftContract, uint256 tokenId, address fundsReceiver, uint256 amount);

    modifier statusIs(AuctionStatus expectedStatus, uint256 _auctionId) {
        require(expectedStatus == _getAuctionStatus(_auctionId));
        _;
    }

    function createAuction(
        address _nftContract,
        uint256 _tokenId,
        uint128 _price,
        uint256 _duration,
        uint256 _bidIncrement
    ) public nonReentrant returns (uint256) {
        
        require(
            msg.sender == IERC721(_nftContract).ownerOf(_tokenId),
            "Should be the owner of token"
        );
        // Need TBC do we need _startTime and _endTime
        // require(_startTime >= block.timestamp);
        // require(_endTime >= block.timestamp);
        // require(_endTime > _startTime);

        // Require duration to be at least a minute and calculate block count
        require(_duration >= 60);

        totalAuctions ++;
        
        // Getting a user to approve happens outside of smart contracts
        // use JavaScript to prompt a user to approve
        // approve(address(this), tokenId); // by token owner
        // IERC721(nftContract).approve(address(this), _tokenId);

        Auction storage _auction = auctions.push();
            _auction.seller = payable(msg.sender);
            _auction.nftContract = _nftContract;
            _auction.tokenId = _tokenId;
            _auction.price = _price;
            _auction.duration = _duration;
            _auction.bidIncrement = _bidIncrement;
            _auction.startedAt = block.timestamp;
            _auction.startBlock = block.number;
            _auction.highestBid = 0;
            _auction.highestBidder = payable(address(0x0));
            _auction.cancelled = false;
        
        IERC721(_auction.nftContract).safeTransferFrom(_auction.seller, address(this), _auction.tokenId);

        emit AuctionCreated(totalAuctions, _nftContract, _tokenId, msg.sender, _price, _duration, _bidIncrement);
        
        return totalAuctions;
    }

    function getAuction(uint256 _auctionId)
    external view returns(
        address nftContract,
        uint tokenId, 
        address seller,
        uint256 price,
        uint256 bidIncrement,
        uint256 duration, 
        uint256 startedAt, 
        uint256 startBlock,  
        uint256 highestBid, 
        address highestBidder,
        AuctionStatus status
    ) {
        AuctionStatus _status = _getAuctionStatus(_auctionId);
        Auction storage _auction = auctions[_auctionId];
        return(
            _auction.nftContract, 
            _auction.tokenId, 
            _auction.seller,
            _auction.price, 
            _auction.bidIncrement,
            _auction.duration, 
            _auction.startedAt, 
            _auction.startBlock, 
            _auction.highestBid,
            _auction.highestBidder,
            _status
            );
    }

    function getNFTPrice(uint256 _auctionId) public view returns(uint) {
        Auction storage _auction = auctions[_auctionId];
        return _auction.price;
    }

    function placeBid(uint256 _auctionId, uint256 _amount) public /*payable*/ statusIs(AuctionStatus.Active, _auctionId) nonReentrant returns (bool) {
        // require(msg.value > 0, "Auction: bid can't be empty value");
        require(_amount > 0, "Auction: bid can't be empty value");
        // Make a check that msg.value token is payToken
        // require(address(msg.value) == payToken);
        // check balance(msg.sender) != 0 //tokenContract(payToken);
        
        Auction storage auction = auctions[_auctionId];

        uint256 nftPrice = getNFTPrice(_auctionId);

        // Require newBid be greater than or equal to highestBid + bidIncrement
        uint256 newBid = auction.fundsByBidder[msg.sender] + _amount; // msg.value;
        require(newBid >= nftPrice, "Auction: bid should be higher than initial price");
        require(newBid >= auction.highestBid + auction.bidIncrement, "Auction: new bid should be higher than highest price and bid increment");

        // Handle incoming bid
        uint256 beforeBalance = payToken.balanceOf(address(this));
        console.log("beforeBalance ", beforeBalance);
        payToken.safeTransferFrom(msg.sender, address(this), _amount);
        uint256 afterBalance = payToken.balanceOf(address(this));
        console.log("afterBalance ", afterBalance);
        require(beforeBalance.add(_amount) == afterBalance, "Auction: Token transfer call did not transfer expected amount");
        require(beforeBalance < afterBalance, "Auction: Token transfer call did not transfer expected amount");

        // Update fundsByBidder mapping
        auction.highestBid = newBid;
        auction.highestBidder = msg.sender;
        auction.fundsByBidder[auction.highestBidder] = newBid;

        // Emit BidCreated event
        emit BidCreated(_auctionId, auction.nftContract, auction.tokenId, msg.sender, newBid);

        return true;
    }

    // Return bid for given auction ID and bidder
    function getBid(uint256 _auctionId, address bidder)
    external view returns(uint256) {
        Auction storage auction = auctions[_auctionId];
        return auction.fundsByBidder[bidder];
    }

    // Return highest bid for given auction ID
    function getHighestBid(uint256 _auctionId)
    external view returns(uint256) {
        Auction storage auction = auctions[_auctionId];
        return auction.highestBid;
    }

    // Utility functions
    function _getAuctionStatus(uint256 _auctionId) internal view returns(AuctionStatus) {
        Auction storage auction = auctions[_auctionId];

        if (auction.cancelled) {
            return AuctionStatus.Cancelled;
        } else if (auction.startedAt + auction.duration < block.timestamp) {
            return AuctionStatus.Completed;
        } else {
            return AuctionStatus.Active;
        }
    }

    function getAuctionCount() public view returns (uint256) {
        return auctions.length;
    }

    // function _sendFunds(address beneficiary, uint256 value) internal {
    //     address payable addr  = payable(beneficiary);
    //     addr.transfer(value);
    // }

    function withdrawBalance(uint256 _auctionId) external nonReentrant returns (bool success) {
        AuctionStatus _status = _getAuctionStatus(_auctionId);

        Auction storage auction = auctions[_auctionId];
        address fundsFrom;
        uint256 withdrawalAmount;

        // The seller gets receives highest bid when the auction is completed.
        // Highest bidder can only withdraw the NFT when the auction is completed.
        // When the auction is cancelled, the highest  bidder is set to address(0).
        if (msg.sender == auction.seller || msg.sender == auction.highestBidder) {
            require(_status == AuctionStatus.Completed, "Auction: please wait for the auction to complete");
            fundsFrom = auction.highestBidder;
            withdrawalAmount = auction.highestBid;
            
            require(withdrawalAmount > 0);
            auction.fundsByBidder[fundsFrom] -= withdrawalAmount;

            console.log("withdrawalAmount ", withdrawalAmount);
       
            payToken.safeTransferFrom(address(this), payable(auction.seller), withdrawalAmount);
            // _sendFunds(auction.seller, withdrawalAmount);
            
            IERC721(auction.nftContract).safeTransferFrom(address(this), auction.highestBidder, auction.tokenId);
            
            emit AuctionNFTWithdrawal(_auctionId, auction.nftContract, auction.tokenId, msg.sender);
        }
        // Anyone else get what they bid
        else {
            // not highestBidder can withdrawalAmount before auction completed
            // require(_status == AuctionStatus.Completed, "Auction: please wait for the auction to complete");
            fundsFrom = msg.sender;
            withdrawalAmount = auction.fundsByBidder[fundsFrom];
            
            require(withdrawalAmount > 0);
            auction.fundsByBidder[fundsFrom] -= withdrawalAmount;
            payToken.safeTransferFrom(address(this), payable(msg.sender), withdrawalAmount);
            // _sendFunds(msg.sender, withdrawalAmount);
        }

        emit ActionFundWithdrawal(_auctionId, auction.nftContract, auction.tokenId, msg.sender, withdrawalAmount);

        return true;
    }
    
    function safeTransferFrom(uint256 _auctionId, address _to) public onlyOwner {
        AuctionStatus _status = _getAuctionStatus(_auctionId);
        require(_status != AuctionStatus.Active, "Auction: Auction is still active");
        Auction storage auction = auctions[_auctionId];
        IERC721(auction.nftContract).safeTransferFrom(address(this), _to, auction.tokenId);
    }

    // _paymentToken should be set in constructor, to be deleted this function
    function setPaymentToken(address _paymentToken) public onlyOwner {
        payToken = IERC20(_paymentToken);
    }
}