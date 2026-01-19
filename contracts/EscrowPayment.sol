// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/*
  EscrowPayment
  - Buyer creates order + deposits ETH into escrow
  - Buyer confirms delivery -> escrow releases ETH to seller
  - After release, buyer can submit rating (stored in SellerReputation)
*/

interface ISellerReputation {
    function recordRating(
        uint256 orderId,
        address seller,
        address buyer,
        uint8 stars,
        string calldata comment
    ) external;
}

contract EscrowPayment {
    struct Order {
        address buyer;
        address seller;
        uint256 amount;     // ETH in wei
        bool shipped;
        bool delivered;
        bool paidOut;
        bool rated;
    }

    uint256 public nextOrderId;
    mapping(uint256 => Order) public orders;

    ISellerReputation public reputation;

    event OrderCreated(uint256 indexed orderId, address indexed buyer, address indexed seller, uint256 amount);
    event ShipmentConfirmed(uint256 indexed orderId, address indexed seller);
    event DeliveryConfirmed(uint256 indexed orderId, address indexed buyer);
    event PaymentReleased(uint256 indexed orderId, address indexed seller, uint256 amount);
    event RatingSubmitted(uint256 indexed orderId, address indexed seller, address indexed buyer, uint8 stars);

    constructor(address reputationContract) {
        require(reputationContract != address(0), "Invalid reputation address");
        reputation = ISellerReputation(reputationContract);
    }

    // 1) Buyer creates an order and deposits ETH into escrow
    function createOrder(address seller) external payable returns (uint256 orderId) {
        require(seller != address(0), "Invalid seller");
        require(msg.value > 0, "Must deposit ETH");

        orderId = nextOrderId;
        nextOrderId += 1;

        orders[orderId] = Order({
            buyer: msg.sender,
            seller: seller,
            amount: msg.value,
            shipped: false,
            delivered: false,
            paidOut: false,
            rated: false
        });

        emit OrderCreated(orderId, msg.sender, seller, msg.value);
    }

    // 2) Seller confirms shipment
    function confirmShipment(uint256 orderId) external {
        Order storage o = orders[orderId];
        require(o.seller == msg.sender, "Only seller can confirm");
        require(o.amount > 0, "Order not found");
        require(!o.shipped, "Already shipped");
        require(!o.paidOut, "Already paid");

        o.shipped = true;
        emit ShipmentConfirmed(orderId, msg.sender);
    }

    // 3) Buyer confirms delivery
    function confirmDelivery(uint256 orderId) external {
        Order storage o = orders[orderId];
        require(o.buyer == msg.sender, "Only buyer can confirm");
        require(o.shipped, "Not shipped yet");
        require(!o.delivered, "Already confirmed");
        require(!o.paidOut, "Already paid");

        o.delivered = true;
        emit DeliveryConfirmed(orderId, msg.sender);
    }

    // 4) Release payment to seller (can be triggered by buyer or seller after delivery confirmed)
    function releasePayment(uint256 orderId) external {
        Order storage o = orders[orderId];
        require(o.amount > 0, "Order not found");
        require(o.shipped, "Shipment not confirmed");
        require(o.delivered, "Delivery not confirmed");
        require(!o.paidOut, "Already paid");

        // Checks-effects-interactions
        o.paidOut = true;
        uint256 amt = o.amount;
        o.amount = 0;

        (bool ok, ) = payable(o.seller).call{value: amt}("");
        require(ok, "Transfer failed");

        emit PaymentReleased(orderId, o.seller, amt);
    }

    // 5) Buyer submits rating ONLY after payout (this prevents fake reviews)
    function submitRating(uint256 orderId, uint8 stars, string calldata comment) external {
        Order storage o = orders[orderId];
        require(o.buyer == msg.sender, "Only buyer can rate");
        require(o.paidOut, "Payment not released yet");
        require(!o.rated, "Already rated");

        o.rated = true;

        // Record rating in Reputation contract (verified by escrow)
        reputation.recordRating(orderId, o.seller, o.buyer, stars, comment);

        emit RatingSubmitted(orderId, o.seller, o.buyer, stars);
    }

    // Helper: view order basic status
    function getOrder(uint256 orderId)
        external
        view
        returns (address buyer, address seller, uint256 amountWei, bool shipped, bool delivered, bool paidOut, bool rated)
    {
        Order memory o = orders[orderId];
        return (o.buyer, o.seller, o.amount, o.shipped, o.delivered, o.paidOut, o.rated);
    }
}
