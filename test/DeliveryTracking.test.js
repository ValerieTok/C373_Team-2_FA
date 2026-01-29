const DeliveryTracking = artifacts.require("DeliveryTracking");
const OrderRegistry = artifacts.require("OrderRegistry");

contract("DeliveryTracking", (accounts) => {
  const seller = accounts[1];
  const buyer = accounts[2];

  let orders;
  let delivery;

  beforeEach(async () => {
    orders = await OrderRegistry.new();
    delivery = await DeliveryTracking.new(orders.address);
  });

  it("tracks delivery status through confirmation", async () => {
    const listingId = 1;
    const qty = 2;

    await orders.createOrder(listingId, buyer, seller, qty);
    const orderId = (await orders.nextOrderId()).toNumber() - 1;

    await delivery.markShipped(orderId, "TRACK-001", { from: seller });
    await delivery.markInTransit(orderId, { from: seller });
    await delivery.markDelivered(orderId, { from: seller });
    await delivery.confirmDelivery(orderId, { from: buyer });

    const deliveryInfo = await delivery.deliveries(orderId);
    assert.equal(
      deliveryInfo.status.toNumber(),
      4,
      "status should be Confirmed"
    );
    assert.equal(
      deliveryInfo.trackingId,
      "TRACK-001",
      "trackingId should be recorded"
    );
  });
});
