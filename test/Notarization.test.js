const Notarization = artifacts.require("Notarization");
const OrderRegistry = artifacts.require("OrderRegistry");

contract("Notarization", (accounts) => {
  const seller = accounts[1];
  const buyer = accounts[2];

  let orderRegistry;
  let notarization;

  before(async () => {
    // Deploy fresh contracts for this suite
    orderRegistry = await OrderRegistry.new();
    notarization = await Notarization.new(orderRegistry.address);
  });

  describe("notarizePurchase", () => {
    it("stores a purchase hash and can be retrieved", async () => {
      // Arrange
      console.log("Accounts:", accounts);
      console.log("Buyer:", buyer);
      console.log("Seller:", seller);

      const listingId = 101;
      const qty = 2;
      const orderId = await orderRegistry.createOrder.call(listingId, buyer, seller, qty, {
        from: seller,
      });
      await orderRegistry.createOrder(listingId, buyer, seller, qty, { from: seller });
      const docHash = web3.utils.keccak256("purchase-doc-1");
      console.log("Order ID:", orderId.toString());
      console.log("Document hash:", docHash);

      // Act
      await notarization.notarizePurchase(orderId, docHash, { from: buyer });
      const result = await notarization.verifyPurchase(orderId);
      console.log("Stored hash:", result.hash);
      console.log("Stored timestamp:", result.timestamp.toString());

      // Assert
      assert.equal(result.hash, docHash, "Stored hash should match");
      assert.isTrue(result.timestamp.toNumber() > 0, "Timestamp should be set");
    });
  });
});
