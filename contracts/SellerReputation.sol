// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract SellerReputation {
    address public escrowContract;

    // seller => totalStars accumulated
    mapping(address => uint256) public totalStars;
    // seller => number of ratings received
    mapping(address => uint256) public ratingCount;

    // Prevent the same order being rated twice
    mapping(uint256 => bool) public orderRated;

    event EscrowContractSet(address indexed escrow);
    event SellerRated(uint256 indexed orderId, address indexed seller, address indexed buyer, uint8 stars, string comment);

    modifier onlyEscrow() {
        require(msg.sender == escrowContract, "Only escrow can rate");
        _;
    }

    // Set escrow contract once
    function setEscrowContract(address _escrow) external {
        require(escrowContract == address(0), "Escrow already set");
        require(_escrow != address(0), "Invalid escrow");
        escrowContract = _escrow;
        emit EscrowContractSet(_escrow);
    }

    function getAverageRating(address seller) external view returns (uint256 avgTimes100) {
        if (ratingCount[seller] == 0) return 0;
        return (totalStars[seller] * 100) / ratingCount[seller];
    }

    // Called by escrow contract only after successful payment release
    function recordRating(
        uint256 orderId,
        address seller,
        address buyer,
        uint8 stars,
        string calldata comment
    ) external onlyEscrow {
        require(!orderRated[orderId], "Order already rated");
        require(stars >= 1 && stars <= 5, "Stars must be 1-5");
        require(seller != address(0) && buyer != address(0), "Invalid parties");

        orderRated[orderId] = true;
        totalStars[seller] += stars;
        ratingCount[seller] += 1;

        emit SellerRated(orderId, seller, buyer, stars, comment);
    }
}
