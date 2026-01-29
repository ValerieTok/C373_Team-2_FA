// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./OrderRegistry.sol";

contract DeliveryTracking {

    OrderRegistry public orderRegistry;
    address public escrowAddress;
    address public owner;

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
    event EscrowAddressSet(address indexed escrow);

    mapping(uint256 => Delivery) public deliveries;

    constructor(address orderRegistryAddress) {
        orderRegistry = OrderRegistry(orderRegistryAddress);
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "DeliveryTracking: not owner");
        _;
    }

    function setEscrowAddress(address escrow) external onlyOwner {
        require(escrow != address(0), "DeliveryTracking: escrow required");
        require(escrowAddress == address(0), "DeliveryTracking: escrow already set");
        escrowAddress = escrow;
        emit EscrowAddressSet(escrow);
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

    function advanceToDelivered(uint256 orderId, string calldata trackingId) external {
        require(msg.sender == orderRegistry.getSeller(orderId));

        DeliveryStatus current = deliveries[orderId].status;
        if (current < DeliveryStatus.Shipped) {
            deliveries[orderId] = Delivery(
                DeliveryStatus.Shipped,
                trackingId
            );
            emit ShipmentMarked(orderId, msg.sender, trackingId);
            current = DeliveryStatus.Shipped;
        }
        if (current == DeliveryStatus.Shipped) {
            deliveries[orderId].status = DeliveryStatus.InTransit;
            emit InTransitMarked(orderId, msg.sender);
            current = DeliveryStatus.InTransit;
        }
        if (current == DeliveryStatus.InTransit) {
            deliveries[orderId].status = DeliveryStatus.Delivered;
            emit DeliveredMarked(orderId, msg.sender);
        }
    }

    function confirmDeliveryByEscrow(uint256 orderId, address buyer) external {
        require(msg.sender == escrowAddress, "DeliveryTracking: escrow only");
        require(buyer == orderRegistry.getBuyer(orderId), "DeliveryTracking: buyer mismatch");
        require(deliveries[orderId].status == DeliveryStatus.Delivered);

        deliveries[orderId].status = DeliveryStatus.Confirmed;
        emit DeliveryConfirmed(orderId, buyer);
    }

    function isConfirmed(uint256 orderId) external view returns (bool) {
        return deliveries[orderId].status == DeliveryStatus.Confirmed;
    }
}
