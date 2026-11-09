module.exports = {
  networks: {
    // Ganache GUI: `truffle migrate --network ganache`
    // (no "development" network, so `truffle test` uses Truffle's built-in chain)
    ganache: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*",
    },
    // `truffle develop`
    develop: {
      port: 8545,
    },
  },
  compilers: {
    solc: {
      version: "0.5.16",
    },
  },
};
