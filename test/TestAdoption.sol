// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0 <0.9.0;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../contracts/Adoption.sol";

contract TestAdoption {
  Adoption adoption = Adoption(DeployedAddresses.Adoption());

  uint expectedAvatarId = 8;
  address expectedOwner = address(this);

  function testUserCanAdoptAvatar() public {
    uint returnedId = adoption.adopt(expectedAvatarId);

    Assert.equal(returnedId, expectedAvatarId, "adopt() should return the claimed avatar id");
  }

  function testGetOwnerByAvatarId() public {
    Assert.equal(adoption.adopters(expectedAvatarId), expectedOwner, "Owner should be this contract");
    Assert.equal(adoption.getOwner(expectedAvatarId), expectedOwner, "getOwner() should match adopters()");
  }

  function testGetOwnerInAdoptersArray() public {
    address[16] memory adopters = adoption.getAdopters();

    Assert.equal(adopters[expectedAvatarId], expectedOwner, "Owner should be this contract");
  }
}
