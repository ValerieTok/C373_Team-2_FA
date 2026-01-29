// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./OrderRegistry.sol";

contract Notarization {
    struct Record {
        bytes32 hash;
        uint256 timestamp;
    }

    OrderRegistry public orderRegistry;

    mapping(uint256 => Record) public purchaseNotarized;
    mapping(uint256 => Record) public shipmentNotarized;
    mapping(uint256 => Record) public deliveryNotarized;

    event PurchaseNotarized(uint256 indexed orderId, bytes32 hash, uint256 timestamp);
    event ShipmentNotarized(uint256 indexed orderId, bytes32 hash, uint256 timestamp);
    event DeliveryNotarized(uint256 indexed orderId, bytes32 hash, uint256 timestamp);

    modifier onlySellerOrBuyer(uint256 orderId) {
        address seller = orderRegistry.getSeller(orderId);
        address buyer = orderRegistry.getBuyer(orderId);
        require(msg.sender == seller || msg.sender == buyer, "Only seller or buyer can notarize");
        _;
    }

    constructor(address orderRegistryAddress) {
        require(orderRegistryAddress != address(0), "OrderRegistry required");
        orderRegistry = OrderRegistry(orderRegistryAddress);
    }

    function notarizePurchase(uint256 orderId, bytes32 hash) external onlySellerOrBuyer(orderId) {
        require(hash != bytes32(0), "Invalid hash");
        require(purchaseNotarized[orderId].timestamp == 0, "Already notarized");
        purchaseNotarized[orderId] = Record(hash, block.timestamp);
        emit PurchaseNotarized(orderId, hash, block.timestamp);
    }

    function notarizeShipment(uint256 orderId, bytes32 hash) external onlySellerOrBuyer(orderId) {
        require(hash != bytes32(0), "Invalid hash");
        require(shipmentNotarized[orderId].timestamp == 0, "Already notarized");
        shipmentNotarized[orderId] = Record(hash, block.timestamp);
        emit ShipmentNotarized(orderId, hash, block.timestamp);
    }

    function notarizeDelivery(uint256 orderId, bytes32 hash) external onlySellerOrBuyer(orderId) {
        require(hash != bytes32(0), "Invalid hash");
        require(deliveryNotarized[orderId].timestamp == 0, "Already notarized");
        deliveryNotarized[orderId] = Record(hash, block.timestamp);
        emit DeliveryNotarized(orderId, hash, block.timestamp);
    }

    function verifyPurchase(uint256 orderId) external view returns (bytes32 hash, uint256 timestamp) {
        Record memory record = purchaseNotarized[orderId];
        return (record.hash, record.timestamp);
    }

    function verifyShipment(uint256 orderId) external view returns (bytes32 hash, uint256 timestamp) {
        Record memory record = shipmentNotarized[orderId];
        return (record.hash, record.timestamp);
    }

    function verifyDelivery(uint256 orderId) external view returns (bytes32 hash, uint256 timestamp) {
        Record memory record = deliveryNotarized[orderId];
        return (record.hash, record.timestamp);
    }
}
