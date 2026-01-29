// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract OrderRegistry {

    struct Order {
        uint256 listingId;
        uint256 qty;
        address buyer;
        address seller;
    }

    uint256 public nextOrderId;
    mapping(uint256 => Order) public orders;

    constructor() {
        nextOrderId = 1;
    }

    function createOrder(
        uint256 listingId,
        address buyer,
        address seller,
        uint256 qty
    ) external returns (uint256) {
        require(qty > 0);

        orders[nextOrderId] = Order(
            listingId,
            qty,
            buyer,
            seller
        );

        nextOrderId = nextOrderId + 1;
        return nextOrderId - 1;
    }

    function getBuyer(uint256 orderId) external view returns (address) {
        return orders[orderId].buyer;
    }

    function getSeller(uint256 orderId) external view returns (address) {
        return orders[orderId].seller;
    }

    function getListingId(uint256 orderId) external view returns (uint256) {
        return orders[orderId].listingId;
    }

    function getQty(uint256 orderId) external view returns (uint256) {
        return orders[orderId].qty;
    }
}
