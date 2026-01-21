// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract Migrations {
  address public owner;
  uint public last_completed_migration;

  // Constructor: Ensure it correctly assigns the owner of the contract
  constructor() {
    owner = msg.sender;
  }

  // Modifier to ensure that only the owner can call restricted functions
  modifier restricted() {
    require(msg.sender == owner, "Only the owner can call this");
    _;
  }

  // Function to set the completed migration
  function setCompleted(uint completed) public restricted {
    last_completed_migration = completed;
  }

  // Function to upgrade the contract
  function upgrade(address new_address) public restricted {
    Migrations upgraded = Migrations(new_address);
    upgraded.setCompleted(last_completed_migration);
  }
}
