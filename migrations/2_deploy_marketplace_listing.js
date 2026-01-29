const MarketplaceListing = artifacts.require("MarketplaceListing");

module.exports = function (deployer) {
    deployer.deploy(MarketplaceListing);
};
