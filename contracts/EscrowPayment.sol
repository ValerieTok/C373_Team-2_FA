// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/*
  EscrowPayment
  - Buyer creates order + deposits ETH into escrow
  - Seller confirms shipment
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
    struct UserVerification {
        bool sellerVerified;
        bool buyerVerified;
        string name;
        string email;
        string phone;
    }

    struct Order {
        address buyer;
        address seller;
        uint256 productId;
        uint256 qty;
        uint256 unitPriceWei;
        uint256 amount;     // ETH in wei
        bool shipped;
        bool delivered;
        bool paidOut;
        bool rated;
        bytes32 proofHash;
        uint256 proofTimestamp;
    }

    uint256 public nextOrderId;
    mapping(uint256 => Order) public orders;
    mapping(address => uint256[]) private buyerOrders;
    mapping(address => uint256[]) private sellerOrders;
    mapping(address => UserVerification) private verifications;
    mapping(bytes32 => address) public orderHashBuyer;
    mapping(bytes32 => uint256) public orderHashTimestamp;

    ISellerReputation public reputation;

    event OrderCreated(
        uint256 indexed orderId,
        address indexed buyer,
        address indexed seller,
        uint256 productId,
        uint256 qty,
        uint256 unitPriceWei,
        uint256 amount
    );
    event ShipmentConfirmed(uint256 indexed orderId, address indexed seller);
    event DeliveryConfirmed(uint256 indexed orderId, address indexed buyer);
    event PaymentReleased(uint256 indexed orderId, address indexed seller, uint256 amount);
    event RatingSubmitted(uint256 indexed orderId, address indexed seller, address indexed buyer, uint8 stars);
    event DocumentNotarized(uint256 indexed orderId, address indexed buyer, bytes32 docHash);
    event PurchaseNotarized(
        address indexed buyer,
        uint256 indexed productId,
        uint256 qty,
        uint256 unitPriceWei,
        bytes32 orderHash,
        uint256 timestamp
    );
    event SellerVerified(address indexed account, string name, string email, string phone);
    event BuyerVerified(address indexed account, string name, string email, string phone);

    constructor(address reputationContract) {
        require(reputationContract != address(0), "Invalid reputation address");
        reputation = ISellerReputation(reputationContract);
    }

    // --- Verification ---
    function _requireBasicInfo(
        string calldata name,
        string calldata email,
        string calldata phone
    ) internal pure {
        require(bytes(name).length > 0, "Name required");
        require(bytes(email).length > 0, "Email required");
        require(bytes(phone).length > 0, "Phone required");
    }

    function verifySeller(
        string calldata name,
        string calldata email,
        string calldata phone
    ) external {
        _requireBasicInfo(name, email, phone);
        UserVerification storage info = verifications[msg.sender];
        info.name = name;
        info.email = email;
        info.phone = phone;
        info.sellerVerified = true;
        emit SellerVerified(msg.sender, name, email, phone);
    }

    function verifyBuyer(
        string calldata name,
        string calldata email,
        string calldata phone
    ) external {
        _requireBasicInfo(name, email, phone);
        UserVerification storage info = verifications[msg.sender];
        info.name = name;
        info.email = email;
        info.phone = phone;
        info.buyerVerified = true;
        emit BuyerVerified(msg.sender, name, email, phone);
    }

    function isSellerVerified(address account) public view returns (bool) {
        return verifications[account].sellerVerified;
    }

    function isBuyerVerified(address account) public view returns (bool) {
        return verifications[account].buyerVerified;
    }

    function getVerification(address account)
        external
        view
        returns (
            bool sellerVerified,
            bool buyerVerified,
            string memory name,
            string memory email,
            string memory phone
        )
    {
        UserVerification memory info = verifications[account];
        return (info.sellerVerified, info.buyerVerified, info.name, info.email, info.phone);
    }

    // 1) Buyer creates an order and deposits ETH into escrow
    function createOrder(
        uint256 productId,
        uint256 qty,
        uint256 unitPriceWei
    ) external payable returns (uint256 orderId) {
        require(isBuyerVerified(msg.sender), "Buyer not verified");
        require(qty > 0, "Quantity must be > 0");
        require(unitPriceWei > 0, "Unit price must be > 0");
        uint256 expected = qty * unitPriceWei;
        require(msg.value == expected, "Incorrect payment amount");

        orderId = nextOrderId;
        nextOrderId += 1;

        orders[orderId] = Order({
            buyer: msg.sender,
            seller: address(0),
            productId: productId,
            qty: qty,
            unitPriceWei: unitPriceWei,
            amount: msg.value,
            shipped: false,
            delivered: false,
            paidOut: false,
            rated: false,
            proofHash: bytes32(0),
            proofTimestamp: 0
        });

        buyerOrders[msg.sender].push(orderId);

        emit OrderCreated(orderId, msg.sender, address(0), productId, qty, unitPriceWei, msg.value);
    }

    // 2) Seller confirms shipment
    function confirmShipment(uint256 orderId) external {
        Order storage o = orders[orderId];
        require(o.amount > 0, "Order not found");
        require(!o.shipped, "Already shipped");
        require(!o.paidOut, "Already paid");
        require(isSellerVerified(msg.sender), "Seller not verified");

        if (o.seller == address(0)) {
            o.seller = msg.sender;
            sellerOrders[msg.sender].push(orderId);
        } else {
            require(o.seller == msg.sender, "Only seller can confirm");
        }
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
        require(o.seller != address(0), "Seller not set");
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

        reputation.recordRating(orderId, o.seller, o.buyer, stars, comment);

        emit RatingSubmitted(orderId, o.seller, o.buyer, stars);
    }

    // 6) Buyer notarizes proof of delivery with a document hash
    function notarizeDelivery(uint256 orderId, bytes32 docHash) external {
        Order storage o = orders[orderId];
        require(o.buyer == msg.sender, "Only buyer can notarize");
        require(o.delivered, "Delivery not confirmed");
        require(docHash != bytes32(0), "Invalid document hash");
        require(o.proofHash == bytes32(0), "Already notarized");

        o.proofHash = docHash;
        o.proofTimestamp = block.timestamp;
        emit DocumentNotarized(orderId, msg.sender, docHash);
    }

    // 7) Buyer notarizes a purchase receipt hash (proof of purchase)
    function notarizePurchase(
        bytes32 orderHash,
        uint256 productId,
        uint256 qty,
        uint256 unitPriceWei
    ) external {
        require(isBuyerVerified(msg.sender), "Buyer not verified");
        require(orderHash != bytes32(0), "Invalid hash");
        require(orderHashBuyer[orderHash] == address(0), "Hash already notarized");
        orderHashBuyer[orderHash] = msg.sender;
        orderHashTimestamp[orderHash] = block.timestamp;
        emit PurchaseNotarized(msg.sender, productId, qty, unitPriceWei, orderHash, block.timestamp);
    }

    // Helper: view order basic status
    function getOrder(uint256 orderId)
        external
        view
        returns (
            address buyer,
            address seller,
            uint256 productId,
            uint256 qty,
            uint256 unitPriceWei,
            uint256 amountWei,
            bool shipped,
            bool delivered,
            bool paidOut,
            bool rated,
            bytes32 proofHash,
            uint256 proofTimestamp
        )
    {
        Order memory o = orders[orderId];
        return (
            o.buyer,
            o.seller,
            o.productId,
            o.qty,
            o.unitPriceWei,
            o.amount,
            o.shipped,
            o.delivered,
            o.paidOut,
            o.rated,
            o.proofHash,
            o.proofTimestamp
        );
    }

    function getBuyerOrders(address buyer) external view returns (uint256[] memory) {
        return buyerOrders[buyer];
    }

    function getSellerOrders(address seller) external view returns (uint256[] memory) {
        return sellerOrders[seller];
    }
}
