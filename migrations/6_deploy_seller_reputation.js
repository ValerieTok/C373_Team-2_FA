const SellerReputation = artifacts.require("SellerReputation");
const OrderRegistry = artifacts.require("OrderRegistry");

module.exports = async function (deployer) {
    const orderRegistry = await OrderRegistry.deployed();
    await deployer.deploy(SellerReputation, orderRegistry.address);
};
