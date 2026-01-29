// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./MarketplaceListing.sol";
import "./OrderRegistry.sol";
import "./DeliveryTracking.sol";

contract PaymentEscrow {

    MarketplaceListing public listingContract;
    OrderRegistry public orderRegistry;
    DeliveryTracking public deliveryTracking;

    mapping(uint256 => uint256) public escrowAmount;

    event PaymentReleased(uint256 indexed orderId, address indexed seller, uint256 amountWei);
    event EscrowFunded(
        uint256 indexed orderId,
        address indexed buyer,
        address indexed seller,
        uint256 amountWei
    );

    constructor(
        address listingAddress,
        address orderRegistryAddress,
        address deliveryAddress
    ) {
        listingContract = MarketplaceListing(listingAddress);
        orderRegistry = OrderRegistry(orderRegistryAddress);
        deliveryTracking = DeliveryTracking(deliveryAddress);
    }

    function pay(uint256 listingId, uint256 qty) external payable returns (uint256) {
        require(qty > 0);
        uint256 priceWei = listingContract.getPrice(listingId);
        uint256 total = priceWei * qty;
        require(msg.value == total);

        uint256 orderId = orderRegistry.createOrder(
            listingId,
            msg.sender,
            listingContract.getSeller(listingId),
            qty
        );

        escrowAmount[orderId] = msg.value;
        emit EscrowFunded(orderId, msg.sender, listingContract.getSeller(listingId), msg.value);
        return orderId;
    }

    function release(uint256 orderId) external {
        require(deliveryTracking.isConfirmed(orderId));

        address seller = orderRegistry.getSeller(orderId);
        uint256 amount = escrowAmount[orderId];

        escrowAmount[orderId] = 0;
        (bool ok, ) = payable(seller).call{value: amount}("");
        require(ok, "PaymentEscrow: transfer failed");
        emit PaymentReleased(orderId, seller, amount);
    }

    function confirmAndRelease(uint256 orderId) external {
        address buyer = orderRegistry.getBuyer(orderId);
        require(msg.sender == buyer, "PaymentEscrow: buyer only");

        deliveryTracking.confirmDeliveryByEscrow(orderId, buyer);

        address seller = orderRegistry.getSeller(orderId);
        uint256 amount = escrowAmount[orderId];

        escrowAmount[orderId] = 0;
        (bool ok, ) = payable(seller).call{value: amount}("");
        require(ok, "PaymentEscrow: transfer failed");
        emit PaymentReleased(orderId, seller, amount);
    }
}
