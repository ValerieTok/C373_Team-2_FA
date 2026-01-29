const OrderRegistry = artifacts.require("OrderRegistry");
const DeliveryTracking = artifacts.require("DeliveryTracking");

module.exports = async function (deployer) {
    const orderRegistry = await OrderRegistry.deployed();

    await deployer.deploy(
        DeliveryTracking,
        orderRegistry.address
    );
};
