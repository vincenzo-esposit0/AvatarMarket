// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0 <0.9.0;

/// @title Avatar Market
/// @notice Each of the 16 cosmonaut avatars can be claimed exactly once.
contract Adoption {
  uint public constant SUPPLY = 16;

  /// @notice Owner of each avatar; address(0) means the avatar is still available.
  address[16] public adopters;

  event Adopted(uint indexed avatarId, address indexed owner);

  /// @notice Claim an available avatar for the caller.
  function adopt(uint avatarId) public returns (uint) {
    require(avatarId < SUPPLY, "Invalid avatar id");
    require(adopters[avatarId] == address(0), "Avatar already claimed");

    adopters[avatarId] = msg.sender;
    emit Adopted(avatarId, msg.sender);

    return avatarId;
  }

  /// @notice All owners at once, so the UI needs a single call.
  function getAdopters() public view returns (address[16] memory) {
    return adopters;
  }

  /// @notice Owner of a single avatar.
  function getOwner(uint avatarId) public view returns (address) {
    require(avatarId < SUPPLY, "Invalid avatar id");
    return adopters[avatarId];
  }
}
