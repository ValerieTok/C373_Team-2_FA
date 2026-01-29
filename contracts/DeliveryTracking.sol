// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./OrderRegistry.sol";

contract DeliveryTracking {

    OrderRegistry public orderRegistry;

    enum DeliveryStatus {
        Paid,
        Shipped,
        InTransit,
        Delivered,
        Confirmed
    }

    struct Delivery {
        DeliveryStatus status;
        string trackingId;
    }

    event ShipmentMarked(uint256 indexed orderId, address indexed actor, string trackingId);
    event InTransitMarked(uint256 indexed orderId, address indexed actor);
    event DeliveredMarked(uint256 indexed orderId, address indexed actor);
    event DeliveryConfirmed(uint256 indexed orderId, address indexed actor);

    mapping(uint256 => Delivery) public deliveries;

    constructor(address orderRegistryAddress) {
        orderRegistry = OrderRegistry(orderRegistryAddress);
    }

    function markShipped(uint256 orderId, string calldata trackingId) external {
        require(msg.sender == orderRegistry.getSeller(orderId));

        deliveries[orderId] = Delivery(
            DeliveryStatus.Shipped,
            trackingId
        );

        emit ShipmentMarked(orderId, msg.sender, trackingId);
    }

    function markInTransit(uint256 orderId) external {
        require(msg.sender == orderRegistry.getSeller(orderId));
        require(deliveries[orderId].status == DeliveryStatus.Shipped);

        deliveries[orderId].status = DeliveryStatus.InTransit;
        emit InTransitMarked(orderId, msg.sender);
    }

    function markDelivered(uint256 orderId) external {
        require(msg.sender == orderRegistry.getSeller(orderId));
        require(deliveries[orderId].status == DeliveryStatus.InTransit);

        deliveries[orderId].status = DeliveryStatus.Delivered;
        emit DeliveredMarked(orderId, msg.sender);
    }

    function confirmDelivery(uint256 orderId) external {
        require(msg.sender == orderRegistry.getBuyer(orderId));
        require(deliveries[orderId].status == DeliveryStatus.Delivered);

        deliveries[orderId].status = DeliveryStatus.Confirmed;
        emit DeliveryConfirmed(orderId, msg.sender);
    }

    function isConfirmed(uint256 orderId) external view returns (bool) {
        return deliveries[orderId].status == DeliveryStatus.Confirmed;
    }
}
