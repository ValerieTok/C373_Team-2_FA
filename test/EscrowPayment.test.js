const EscrowPayment = artifacts.require("./EscrowPayment.sol");

contract("EscrowPayment", (accounts) => {
  const deployer = accounts[0];
  const seller = accounts[1];
  const buyer = accounts[2];

  let escrow;

  before(async () => {
    escrow = await EscrowPayment.deployed();
    await escrow.verifyBuyer("Buyer One", "buyer@example.com", "22222222", {
      from: buyer,
    });
  });

  it("allows a buyer to place an order and records createdAt", async () => {
    const productId = 1;
    const qty = 2;
    const unitPriceWei = web3.utils.toBN(web3.utils.toWei("1", "gwei"));
    const totalWei = unitPriceWei.muln(qty);

    const tx = await escrow.createOrder(productId, qty, unitPriceWei, {
      from: buyer,
      value: totalWei.toString(),
    });

    const createdAt = (await web3.eth.getBlock(tx.receipt.blockNumber)).timestamp;
    const event = tx.logs.find((log) => log.event === "OrderCreated");
    const orderId = event.args.orderId.toNumber();
    const order = await escrow.orders(orderId);

    assert(order.buyer, "Order not found");
    assert(createdAt > 0, "createdAt should be > 0");
    assert.equal(order.buyer, buyer, "Buyer address not recorded");
  });
});
