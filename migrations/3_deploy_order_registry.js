const OrderRegistry = artifacts.require("OrderRegistry");

module.exports = function (deployer) {
    deployer.deploy(OrderRegistry);
};
