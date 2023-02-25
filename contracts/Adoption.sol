// SPDX-License-Identifier: MIT
// Adoption.deployed().then(function(i) {contract=i;})
pragma solidity >=0.4.22 <0.8.17;

contract Adoption {
  address[16] public adopters;

  // Obtain avatar
  function adopt(uint avatarId) public returns (uint) {

    require(avatarId >= 0 && avatarId <= 15);

    adopters[avatarId] = msg.sender;

    return avatarId;
  }

  // Retrieving the adopters
  function getAdopters() public view returns (address[16] memory) {
    return adopters;
  }

  function getOwner(uint id) public view returns (address addr){
    return addr = adopters[id];
  }



}
