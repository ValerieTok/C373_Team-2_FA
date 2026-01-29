// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MarketplaceListing {

    struct Listing {
        address seller;
        string name;
        string category;
        string description;
        string imageUrl;
        uint256 priceWei;
        bool active;
        uint256 createdAt;
    }

    uint256 public nextListingId;
    mapping(uint256 => Listing) public listings;

    event ProductAdded(
        uint256 indexed productId,
        address indexed seller,
        string name,
        string category,
        string description,
        uint256 priceWei,
        string imageUrl,
        uint256 timestamp
    );
    event ListingCreated(
        uint256 indexed listingId,
        address indexed seller,
        uint256 priceWei,
        uint256 timestamp
    );

    constructor() {
        nextListingId = 1;
    }

    function addProduct(
        string calldata name,
        string calldata category,
        string calldata description,
        string calldata imageUrl,
        uint256 priceWei
    ) external {
        _addProduct(name, category, description, imageUrl, priceWei);
    }

    function _addProduct(
        string memory name,
        string memory category,
        string memory description,
        string memory imageUrl,
        uint256 priceWei
    ) internal {
        require(priceWei > 0, "Price required");

        listings[nextListingId] = Listing(
            msg.sender,
            name,
            category,
            description,
            imageUrl,
            priceWei,
            true,
            block.timestamp
        );

        emit ProductAdded(
            nextListingId,
            msg.sender,
            name,
            category,
            description,
            priceWei,
            imageUrl,
            block.timestamp
        );
        emit ListingCreated(
            nextListingId,
            msg.sender,
            priceWei,
            block.timestamp
        );

        nextListingId = nextListingId + 1;
    }

    function createListing(
        string calldata name,
        string calldata category,
        string calldata shortDesc,
        string calldata fullDesc,
        string calldata image,
        uint256 priceWei
    ) external {
        string memory description = bytes(fullDesc).length > 0 ? fullDesc : shortDesc;
        _addProduct(name, category, description, image, priceWei);
    }

    function getSeller(uint256 listingId) external view returns (address) {
        return listings[listingId].seller;
    }

    function getPrice(uint256 listingId) external view returns (uint256) {
        return listings[listingId].priceWei;
    }

    function isActive(uint256 listingId) external view returns (bool) {
        return listings[listingId].active;
    }
}
