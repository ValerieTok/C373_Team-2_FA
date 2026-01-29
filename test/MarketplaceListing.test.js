const MarketplaceListing = artifacts.require("MarketplaceListing");

contract("MarketplaceListing", (accounts) => {
  const seller = accounts[1];

  let listing;

  beforeEach(async () => {
    listing = await MarketplaceListing.new();
  });

  it("creates a listing and stores its data", async () => {
    const priceWei = web3.utils.toBN(web3.utils.toWei("5", "gwei"));

    const listingId = (await listing.nextListingId()).toNumber();
    const tx = await listing.createListing(
      "Canvas Bag",
      "Accessories",
      "Short description",
      "",
      "https://example.com/bag.png",
      priceWei.toString(),
      { from: seller }
    );

    const event = tx.logs.find((log) => log.event === "ProductAdded");
    assert(event, "ProductAdded event missing");

    const stored = await listing.listings(listingId);
    assert.equal(stored.seller, seller, "seller should match");
    assert.equal(stored.name, "Canvas Bag", "name should match");
    assert.equal(stored.category, "Accessories", "category should match");
    assert.equal(
      stored.description,
      "Short description",
      "description should fall back to shortDesc"
    );
    assert.equal(
      stored.priceWei.toString(),
      priceWei.toString(),
      "price should match"
    );
    assert.equal(stored.active, true, "listing should be active");
    assert(stored.createdAt.toNumber() > 0, "createdAt should be set");
  });
});
