const Notarization = artifacts.require("Notarization");
const OrderRegistry = artifacts.require("OrderRegistry");

module.exports = async function (deployer) {
  const orderRegistry = await OrderRegistry.deployed();
  await deployer.deploy(Notarization, orderRegistry.address);
};
