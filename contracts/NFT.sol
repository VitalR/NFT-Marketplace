// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";


contract NFT is ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;
    address contractAddress;
    
    event TokenCreated(uint256 indexed tokenId, address tokenCreator, string class, uint256 initialPrice);
    event TokenBurned(uint256 indexed tokenId, address tokenContractOwner);
    
    uint256 private ticketId;
    string public mintingDate;
    string public showName;
    string public showTime;
    string public showLocation;
    string public showVenue;
    string public artistName;
    string public showDate;
    
    struct TicketItem {
        uint256 ticketId;
        string mintingDate;
        string showName;
        string showTime;
        string showLocation;
        string showVenue;
        string artistName;
        string showDate;
        string class;
        uint256 initialPrice;
        string tokenURI;
    }

    // TicketItem[] public tickets;
    mapping(uint256 => TicketItem) public tokenIdToTicketItem;
    
    /**
     * @dev Initializes the contract setting:
     * Market contract address, the initial owner and token attributes
     */
    constructor(
        address _marketplaceAddress,
        uint256 _ticketId,
        string memory _mintingDate,
        string memory _showName,
        string memory _artistName,
        string memory _showDate,
        string memory _showTime,
        string memory _showVenue,
        string memory _showLocation
    ) ERC721("First Live NFT Show", "NFT") {
        contractAddress = _marketplaceAddress;
        ticketId = _ticketId;
        mintingDate = _mintingDate;
        showName = _showName;
        artistName = _artistName;
        showDate = _showDate;
        showTime = _showTime;
        showVenue = _showVenue;
        showLocation = _showLocation;
    }
    
    // Create Token by Owner
    function createToken(
        address recipient,
        string memory class, 
        uint256 initialPrice,
        string[] memory tokenURI
    ) public onlyOwner {
        uint256 numberOfTokens = tokenURI.length;
        
        for (uint256 i = 0; i < numberOfTokens; i++) {

            // Get mintable ID
            _tokenIds.increment();
            uint256 newItemId = _tokenIds.current();

            TicketItem storage ticket = tokenIdToTicketItem[newItemId];
                ticket.ticketId = newItemId;
                ticket.mintingDate = mintingDate;
                ticket.showName = showName;
                ticket.artistName = artistName;
                ticket.showDate = showDate;
                ticket.showTime = showTime;
                ticket.showVenue = showVenue;
                ticket.showLocation = showLocation;
                ticket.class = class;
                ticket.initialPrice = initialPrice;
                ticket.tokenURI = tokenURI[i];

            // Mint token
            _mint(recipient, newItemId);
            // Set tokenURI for minted token
            _setTokenURI(newItemId, tokenURI[i]);
            // Set approve for Market contract
            setApprovalForAll(contractAddress, true);
            // Create event
            emit TokenCreated(newItemId, recipient, class, initialPrice);
        }
    }

    function getTicket(uint256 tokenId) public view returns (
        uint256, string memory, string memory, string memory, string memory, string memory, string memory, string memory, string memory, uint256, string memory) {
        TicketItem storage ticket = tokenIdToTicketItem[tokenId];
        return (
            ticket.ticketId,
            ticket.mintingDate,
            ticket.showName,
            ticket.artistName,
            ticket.showDate,
            ticket.showTime,
            ticket.showVenue,
            ticket.showLocation,
            ticket.class,
            ticket.initialPrice,
            ticket.tokenURI
        );
    }

    function getTicketInitialPrice(uint256 tokenId) public view returns (uint256) {
        TicketItem storage ticket = tokenIdToTicketItem[tokenId];
        return ticket.initialPrice;
    }

    function setTicketInitialPrice(uint256 tokenId, uint256 newInitialPrice) public onlyOwner {
        TicketItem storage ticket = tokenIdToTicketItem[tokenId];
        ticket.initialPrice = newInitialPrice;
    }
    
    function burnToken(uint256 tokenId) public onlyOwner {
        require(_isApprovedOrOwner(_msgSender(), tokenId), "NFT: caller is not owner nor approved");
        _burn(tokenId);
        emit TokenBurned(tokenId, msg.sender);
    }

}