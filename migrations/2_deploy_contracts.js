const SellerReputation = artifacts.require("SellerReputation");
const EscrowPayment = artifacts.require("EscrowPayment");

module.exports = async function (deployer) {
  // 1) Deploy SellerReputation
  await deployer.deploy(SellerReputation);
  const reputationInstance = await SellerReputation.deployed();

  // 2) Deploy EscrowPayment and pass in the reputation contract address
  await deployer.deploy(EscrowPayment, reputationInstance.address);
  const escrowInstance = await EscrowPayment.deployed();

  // 3) Link Reputation -> Escrow (only escrow can record ratings)
  await reputationInstance.setEscrowContract(escrowInstance.address);
};
