const Adoption = artifacts.require("Adoption");

const ZERO = "0x0000000000000000000000000000000000000000";

async function expectRevert(promise, reason) {
  try {
    await promise;
  } catch (err) {
    assert.include(err.message, reason, `expected revert with "${reason}"`);
    return;
  }
  assert.fail(`expected revert with "${reason}"`);
}

contract("Adoption", (accounts) => {
  const [alice, bob] = accounts;
  let adoption;

  beforeEach(async () => {
    adoption = await Adoption.new();
  });

  it("starts with every avatar available", async () => {
    const adopters = await adoption.getAdopters();
    assert.lengthOf(adopters, 16);
    adopters.forEach((owner) => assert.equal(owner, ZERO));
  });

  it("lets a user claim an avatar and records the owner", async () => {
    await adoption.adopt(8, { from: alice });

    assert.equal(await adoption.adopters(8), alice);
    assert.equal(await adoption.getOwner(8), alice);
    assert.equal((await adoption.getAdopters())[8], alice);
  });

  it("emits an Adopted event", async () => {
    const { logs } = await adoption.adopt(3, { from: bob });

    assert.equal(logs.length, 1);
    assert.equal(logs[0].event, "Adopted");
    assert.equal(logs[0].args.avatarId.toNumber(), 3);
    assert.equal(logs[0].args.owner, bob);
  });

  it("does not let anyone take an avatar that is already claimed", async () => {
    await adoption.adopt(5, { from: alice });

    await expectRevert(adoption.adopt(5, { from: bob }), "Avatar already claimed");
    await expectRevert(adoption.adopt(5, { from: alice }), "Avatar already claimed");
    assert.equal(await adoption.adopters(5), alice);
  });

  it("rejects ids outside the collection", async () => {
    await expectRevert(adoption.adopt(16, { from: alice }), "Invalid avatar id");
    await expectRevert(adoption.getOwner(16), "Invalid avatar id");
  });
});
