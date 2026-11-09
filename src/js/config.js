// Contract deployments the front-end should talk to, keyed by chain ID.
//
// Local Ganache/Truffle deployments are picked up automatically from
// build/contracts/Adoption.json. To use a public testnet, deploy
// contracts/Adoption.sol (e.g. with Remix on Sepolia) and add the address here:
//
//   11155111: "0xYourSepoliaContractAddress",
//
// If the wallet is on a chain without a deployment (or there is no wallet),
// the app falls back to demo mode and simulates the contract in the browser.
window.AVATAR_MARKET_CONFIG = {
  deployments: {
  },
};
