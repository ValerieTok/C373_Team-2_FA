const EscrowPayment = artifacts.require("EscrowPayment");
const SellerReputation = artifacts.require("SellerReputation");

module.exports = async function (deployer) {
  // 1. Deploy SellerReputation first
  await deployer.deploy(SellerReputation);
  const sellerReputationInstance = await SellerReputation.deployed();
  console.log("SellerReputation contract deployed at:", sellerReputationInstance.address);

  // 2. Deploy EscrowPayment with reputation address
  await deployer.deploy(EscrowPayment, sellerReputationInstance.address);
  const escrowPaymentInstance = await EscrowPayment.deployed();
  console.log("EscrowPayment contract deployed at:", escrowPaymentInstance.address);

  // 3. Link Reputation -> Escrow
  await sellerReputationInstance.setEscrowContract(escrowPaymentInstance.address);
  console.log("Escrow contract set in SellerReputation");
};
