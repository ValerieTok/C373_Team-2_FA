const PaymentEscrow = artifacts.require("PaymentEscrow");
const MarketplaceListing = artifacts.require("MarketplaceListing");
const OrderRegistry = artifacts.require("OrderRegistry");
const DeliveryTracking = artifacts.require("DeliveryTracking");

contract("PaymentEscrow", (accounts) => {
  const seller = accounts[1];
  const buyer = accounts[2];

  let listing;
  let orders;
  let delivery;
  let escrow;

  beforeEach(async () => {
    listing = await MarketplaceListing.new();
    orders = await OrderRegistry.new();
    delivery = await DeliveryTracking.new(orders.address);
    escrow = await PaymentEscrow.new(
      listing.address,
      orders.address,
      delivery.address
    );
  });

  it("creates an order and records escrow when paid with exact total", async () => {
    const priceWei = web3.utils.toBN(web3.utils.toWei("1", "gwei"));
    const qty = 3;

    const listingId = (await listing.nextListingId()).toNumber();
    await listing.createListing(
      "Widget",
      "Tools",
      "Short",
      "Full description",
      "https://example.com/widget.png",
      priceWei.toString(),
      { from: seller }
    );

    const total = priceWei.muln(qty);
    await escrow.pay(listingId, qty, {
      from: buyer,
      value: total.toString(),
    });

    const orderId = (await orders.nextOrderId()).toNumber() - 1;
    const order = await orders.orders(orderId);
    const escrowed = await escrow.escrowAmount(orderId);

    assert.equal(order.buyer, buyer, "buyer should be recorded");
    assert.equal(order.seller, seller, "seller should be recorded");
    assert.equal(order.listingId.toNumber(), listingId, "listingId mismatch");
    assert.equal(order.qty.toNumber(), qty, "qty mismatch");
    assert.equal(
      escrowed.toString(),
      total.toString(),
      "escrow amount should match payment"
    );
  });

  it("releases escrow to seller after delivery is confirmed", async () => {
    const priceWei = web3.utils.toBN(web3.utils.toWei("2", "gwei"));
    const qty = 1;

    const listingId = (await listing.nextListingId()).toNumber();
    await listing.createListing(
      "Gadget",
      "Electronics",
      "Short",
      "Full description",
      "https://example.com/gadget.png",
      priceWei.toString(),
      { from: seller }
    );

    const total = priceWei.muln(qty);
    await escrow.pay(listingId, qty, {
      from: buyer,
      value: total.toString(),
    });
    const orderId = (await orders.nextOrderId()).toNumber() - 1;

    await delivery.markShipped(orderId, "TRACK123", { from: seller });
    await delivery.markInTransit(orderId, { from: seller });
    await delivery.markDelivered(orderId, { from: seller });
    await delivery.confirmDelivery(orderId, { from: buyer });

    await escrow.release(orderId, { from: buyer });

    const escrowed = await escrow.escrowAmount(orderId);
    assert.equal(escrowed.toNumber(), 0, "escrow should be cleared");
  });
});
