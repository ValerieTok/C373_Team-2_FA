// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Migrations {
    address public owner;
    uint256 public last_completed_migration;

    constructor() {
        owner = msg.sender;
    }

    modifier restricted() {
        require(msg.sender == owner, "Migrations: caller is not owner");
        _;
    }

    function setCompleted(uint256 completed) external restricted {
        last_completed_migration = completed;
    }
}
