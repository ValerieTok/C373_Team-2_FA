const EscrowPayment = artifacts.require("EscrowPayment");
const SellerReputation = artifacts.require("SellerReputation");

contract("SellerReputation", (accounts) => {
  const seller = accounts[1];
  const buyer = accounts[2];

  let escrow;
  let reputation;

  before(async () => {
    // Deploy fresh contracts for this suite
    reputation = await SellerReputation.new();
    escrow = await EscrowPayment.new(reputation.address);
    await reputation.setEscrowContract(escrow.address);

    await escrow.verifyBuyer("Buyer Two", "buyer2@example.com", "33333333", {
      from: buyer,
    });
    await escrow.verifySeller("Seller One", "seller@example.com", "44444444", {
      from: seller,
    });
  });

  describe("recordRating flow via EscrowPayment", () => {
    it("records a seller rating after payout and updates averages", async () => {
      // Arrange
      const productId = 2;
      const qty = 1;
      const unitPriceWei = web3.utils.toBN(web3.utils.toWei("2", "gwei"));
      const totalWei = unitPriceWei.muln(qty);

      console.log("Arranging order creation for buyer:", buyer);
      const createTx = await escrow.createOrder(productId, qty, unitPriceWei, {
        from: buyer,
        value: totalWei.toString(),
      });
      const createdEvent = createTx.logs.find((log) => log.event === "OrderCreated");
      const orderId = createdEvent.args.orderId.toNumber();
      console.log("Order created with ID:", orderId);

      // Act
      await escrow.confirmShipment(orderId, { from: seller });
      console.log("Shipment confirmed by seller:", seller);
      await escrow.confirmDelivery(orderId, { from: buyer });
      console.log("Delivery confirmed by buyer:", buyer);
      await escrow.releasePayment(orderId, { from: seller });
      console.log("Payment released for order:", orderId);
      const ratingTx = await escrow.submitRating(orderId, 5, "Great seller", {
        from: buyer,
      });

      // Assert
      const ratingEvent = ratingTx.logs.find((log) => log.event === "RatingSubmitted");
      assert(ratingEvent, "RatingSubmitted event missing");

      const totalStars = await reputation.totalStars(seller);
      const ratingCount = await reputation.ratingCount(seller);
      const avgTimes100 = await reputation.getAverageRating(seller);
      const orderRated = await reputation.orderRated(orderId);

      assert.equal(totalStars.toNumber(), 5, "Total stars should be 5");
      assert.equal(ratingCount.toNumber(), 1, "Rating count should be 1");
      assert.equal(avgTimes100.toNumber(), 500, "Average should be 5.00");
      assert.equal(orderRated, true, "Order should be marked rated");
    });
  });
});
