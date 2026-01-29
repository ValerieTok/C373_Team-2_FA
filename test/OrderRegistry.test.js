const OrderRegistry = artifacts.require("OrderRegistry");

contract("OrderRegistry", (accounts) => {
  const buyer = accounts[1];
  const seller = accounts[2];

  let registry;

  before(async () => {
    registry = await OrderRegistry.deployed();
  });

  describe("createOrder", () => {
    it("registers a new order and stores details", async () => {
      // Arrange
      const listingId = 42;
      const qty = 3;
      console.log("Buyer:", buyer);
      console.log("Seller:", seller);

      // Act
      const orderId = await registry.createOrder.call(listingId, buyer, seller, qty, {
        from: seller,
      });
      await registry.createOrder(listingId, buyer, seller, qty, { from: seller });
      console.log("Order ID:", orderId.toString());

      // Assert
      const order = await registry.orders(orderId);
      assert.equal(order.listingId.toNumber(), listingId, "Listing ID should match");
      assert.equal(order.qty.toNumber(), qty, "Quantity should match");
      assert.equal(order.buyer, buyer, "Buyer should match");
      assert.equal(order.seller, seller, "Seller should match");
    });
  });
});
