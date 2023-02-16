// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.8.17;

contract Adoption {
  address[16] public adopters;

  // Adopting a avatar
  function adopt(uint avatarId) public returns (uint) {

    require(avatarId >= 0 && avatarId <= 15);

    adopters[avatarId] = msg.sender;

    return avatarId;
  }

  // Retrieving the adopters
  function getAdopters() public view returns (address[16] memory) {
    return adopters;
  }

}
