// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./OrderRegistry.sol";

contract SellerReputation {

    struct Reputation {
        uint256 totalRatings;
        uint256 sumRatings;
    }

    struct ListingRating {
        uint256 totalRatings;
        uint256 sumRatings;
    }

    OrderRegistry public orderRegistry;
    mapping(address => Reputation) public reputations;
    mapping(uint256 => ListingRating) public listingRatings;
    mapping(uint256 => bool) public ratedOrder;

    event OrderRated(
        uint256 indexed orderId,
        uint256 indexed listingId,
        address indexed buyer,
        address seller,
        uint8 rating
    );

    constructor(address orderRegistryAddress) {
        orderRegistry = OrderRegistry(orderRegistryAddress);
    }

    function rateOrder(
        uint256 orderId,
        uint8 rating
    ) external {
        require(rating >= 1);
        require(rating <= 5);
        require(ratedOrder[orderId] == false);
        require(msg.sender == orderRegistry.getBuyer(orderId));

        ratedOrder[orderId] = true;

        address seller = orderRegistry.getSeller(orderId);
        reputations[seller].totalRatings =
            reputations[seller].totalRatings + 1;

        reputations[seller].sumRatings =
            reputations[seller].sumRatings + rating;

        uint256 listingId = orderRegistry.getListingId(orderId);
        listingRatings[listingId].totalRatings =
            listingRatings[listingId].totalRatings + 1;

        listingRatings[listingId].sumRatings =
            listingRatings[listingId].sumRatings + rating;

        emit OrderRated(orderId, listingId, msg.sender, seller, rating);
    }

    function getAverageRating(address seller) external view returns (uint256) {
        Reputation memory R = reputations[seller];
        require(R.totalRatings > 0);
        return R.sumRatings / R.totalRatings;
    }

    function getListingAverage(uint256 listingId) external view returns (uint256) {
        ListingRating memory L = listingRatings[listingId];
        require(L.totalRatings > 0);
        return L.sumRatings / L.totalRatings;
    }
}
