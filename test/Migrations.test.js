const Migrations = artifacts.require("Migrations");

contract("Migrations", (accounts) => {
  let migrations;

  before(async () => {
    migrations = await Migrations.deployed();
  });

  describe("deployment", () => {
    it("deploys successfully", async () => {
      // Arrange
      const [deployer] = accounts;
      console.log("Accounts:", accounts);
      console.log("Deployer:", deployer);

      // Act
      const address = migrations.address;
      console.log("Migrations address:", address);

      // Assert
      assert.notEqual(address, "0x0", "Address should not be 0x0");
      assert.notEqual(address, "", "Address should not be empty");
      assert.notEqual(address, null, "Address should not be null");
      assert.notEqual(address, undefined, "Address should not be undefined");
    });
  });
});
