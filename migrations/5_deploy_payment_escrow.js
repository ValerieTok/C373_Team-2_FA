const MarketplaceListing = artifacts.require("MarketplaceListing");
const OrderRegistry = artifacts.require("OrderRegistry");
const DeliveryTracking = artifacts.require("DeliveryTracking");
const PaymentEscrow = artifacts.require("PaymentEscrow");

module.exports = async function (deployer) {
    const listing = await MarketplaceListing.deployed();
    const orderRegistry = await OrderRegistry.deployed();
    const delivery = await DeliveryTracking.deployed();

    await deployer.deploy(
        PaymentEscrow,
        listing.address,
        orderRegistry.address,
        delivery.address
    );
};
