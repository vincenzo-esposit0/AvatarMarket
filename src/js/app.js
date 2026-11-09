(() => {
  "use strict";

  const ZERO = "0x0000000000000000000000000000000000000000";
  const SUPPLY = 16;
  const DEMO_KEY = "avatarMarket.demo.v1";
  const POLL_MS = 15000;
  const CONFIG = window.AVATAR_MARKET_CONFIG || {};
  const DEPLOYMENTS = CONFIG.deployments || {};
  const IS_LOCAL = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);

  // Minimal ABI of contracts/Adoption.sol — only what the UI needs.
  const ABI = [
    "function adopt(uint256 avatarId) returns (uint256)",
    "function getAdopters() view returns (address[16])",
  ];

  const CHAINS = {
    1: { name: "Ethereum Mainnet", explorer: "https://etherscan.io" },
    11155111: { name: "Sepolia", explorer: "https://sepolia.etherscan.io" },
    17000: { name: "Holesky", explorer: "https://holesky.etherscan.io" },
    1337: { name: "Ganache" },
    5777: { name: "Ganache" },
    31337: { name: "Hardhat" },
  };

  const state = {
    avatars: [],
    adopters: Array(SUPPLY).fill(ZERO),
    account: null,
    mode: "demo",          // "demo" | "live"
    demoReason: "",
    provider: null,
    contract: null,
    chainId: null,
    filter: "All",
    onlyAvailable: false,
    pending: new Set(),
  };

  const $ = (sel) => document.querySelector(sel);
  const short = (addr) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  const same = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
  const chainName = (id) => CHAINS[id]?.name || `chain ${id}`;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------------------------------------------------------------- toast
  let toastTimer;
  function toast(message, kind = "") {
    const el = $("#toast");
    el.textContent = message;
    el.className = kind ? `toast is-${kind}` : "toast";
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 4500);
  }

  // Turn wallet / RPC errors into something a visitor can read.
  function describeError(err) {
    if (err?.code === "ACTION_REJECTED" || err?.code === 4001 || err?.info?.error?.code === 4001) {
      return "Transaction rejected in the wallet.";
    }
    // Wallets report revert reasons in different shapes; look in the usual places.
    const nested = [err?.info?.error?.message, err?.error?.message, err?.message].find(
      (m) => typeof m === "string" && /revert/i.test(m));
    const reason = err?.reason || err?.revert?.args?.[0] ||
      nested?.match(/(?:reverted with reason string |revert )'?([^'"]+)'?/i)?.[1];
    if (reason) return `Transaction reverted: ${reason.trim()}.`;
    if (err?.code === "INSUFFICIENT_FUNDS") return "Not enough ETH to pay for gas.";
    return err?.shortMessage || "Transaction failed. Check the console for details.";
  }

  // ---------------------------------------------------------------- demo backend
  // A browser-only stand-in for the contract, with the same rules.
  function randomAddress() {
    const bytes = crypto.getRandomValues(new Uint8Array(20));
    return "0x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  function loadDemo() {
    try {
      const saved = JSON.parse(localStorage.getItem(DEMO_KEY));
      if (saved?.account && Array.isArray(saved.adopters) && saved.adopters.length === SUPPLY) return saved;
    } catch (_) { /* storage unavailable or corrupted */ }

    // Seed a few avatars as already claimed by other collectors.
    const adopters = Array(SUPPLY).fill(ZERO);
    [1, 4, 7, 10, 13].forEach((id) => (adopters[id] = randomAddress()));
    return { account: randomAddress(), adopters };
  }

  function saveDemo() {
    try {
      localStorage.setItem(DEMO_KEY, JSON.stringify({ account: state.account, adopters: state.adopters }));
    } catch (_) { /* ignore: demo still works for this page view */ }
  }

  function startDemo(reason) {
    const demo = loadDemo();
    Object.assign(state, {
      mode: "demo",
      demoReason: reason,
      account: demo.account,
      adopters: demo.adopters,
      provider: null,
      contract: null,
    });
    saveDemo();
  }

  async function demoAdopt(id) {
    if (id < 0 || id >= SUPPLY) throw Object.assign(new Error(), { reason: "Invalid avatar id" });
    if (!same(state.adopters[id], ZERO)) throw Object.assign(new Error(), { reason: "Avatar already claimed" });
    await sleep(1100); // simulate block confirmation
    state.adopters[id] = state.account;
    saveDemo();
  }

  // ---------------------------------------------------------------- chain backend
  // Truffle writes local (Ganache) deployments into build/contracts/Adoption.json,
  // which lite-server exposes during development. Public deployments live in config.js.
  async function loadLocalDeployments() {
    if (!IS_LOCAL) return {};
    try {
      const res = await fetch("Adoption.json");
      return res.ok ? (await res.json()).networks || {} : {};
    } catch (_) {
      return {};
    }
  }

  async function connectBackend(localDeployments) {
    if (!window.ethereum) return startDemo("no Web3 wallet detected");
    if (!window.ethers) return startDemo("the ethers.js library could not be loaded");

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const chainId = Number((await provider.getNetwork()).chainId);
      const netVersion = await window.ethereum.request({ method: "net_version" }).catch(() => null);
      state.chainId = chainId;

      const address =
        DEPLOYMENTS[chainId] ||
        localDeployments[netVersion]?.address ||
        localDeployments[chainId]?.address;

      if (!address || (await provider.getCode(address)) === "0x") {
        return startDemo(`the contract is not deployed on ${chainName(chainId)}`);
      }

      Object.assign(state, {
        mode: "live",
        provider,
        contract: new ethers.Contract(address, ABI, provider),
      });

      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      state.account = accounts[0] || null;
      await refreshAdopters();
    } catch (err) {
      console.error(err);
      startDemo("the wallet's network could not be reached");
    }
  }

  async function refreshAdopters() {
    if (state.mode !== "live") return;
    state.adopters = Array.from(await state.contract.getAdopters());
  }

  async function connectWallet() {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    state.account = accounts[0] || null;
  }

  async function switchChain(chainId) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x" + Number(chainId).toString(16) }],
      });
      // The chainChanged listener reloads the page.
    } catch (err) {
      console.error(err);
      toast(`Could not switch network. Select ${chainName(chainId)} in your wallet.`, "error");
    }
  }

  // ---------------------------------------------------------------- actions
  async function claim(id) {
    if (state.pending.has(id)) return;
    state.pending.add(id);
    render();

    try {
      if (state.mode === "demo") {
        await demoAdopt(id);
      } else {
        if (!state.account) await connectWallet();
        // Someone else may have claimed it since the last refresh.
        await refreshAdopters();
        if (!same(state.adopters[id], ZERO)) {
          throw Object.assign(new Error("already claimed"), { reason: "Avatar already claimed" });
        }
        const signer = await state.provider.getSigner();
        const tx = await state.contract.connect(signer).adopt(id);
        toast("Transaction sent — waiting for confirmation…");
        await tx.wait();
      }
      toast(`${state.avatars[id].name} is now yours.`, "success");
    } catch (err) {
      console.error(err);
      toast(describeError(err), "error");
    } finally {
      state.pending.delete(id);
      await refreshAdopters().catch(console.error);
      render();
    }
  }

  async function onWalletClick() {
    if (state.mode === "live") {
      if (state.account) return toast(`Connected as ${state.account}`);
      try {
        await connectWallet();
        render();
      } catch (_) {
        toast("Wallet connection was cancelled.", "error");
      }
      return;
    }
    toast(window.ethereum
      ? "Demo mode: switch your wallet to a network where the contract is deployed."
      : "Demo mode: install MetaMask to interact with a real deployment.");
  }

  function resetDemo() {
    try { localStorage.removeItem(DEMO_KEY); } catch (_) { /* ignore */ }
    startDemo(state.demoReason);
    render();
    toast("Demo reset.");
  }

  // Keep the page in sync with claims made by other people.
  function startPolling() {
    const tick = async () => {
      if (state.mode !== "live" || document.hidden || state.pending.size) return;
      try {
        const before = state.adopters.join();
        await refreshAdopters();
        if (state.adopters.join() !== before) render();
      } catch (err) {
        console.warn("Could not refresh owners", err);
      }
    };
    setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
  }

  // ---------------------------------------------------------------- rendering
  function statusOf(id) {
    const owner = state.adopters[id] || ZERO;
    if (same(owner, ZERO)) return { kind: "free", owner };
    if (same(owner, state.account)) return { kind: "mine", owner };
    return { kind: "taken", owner };
  }

  function buildCard(avatar) {
    const node = $("#cardTemplate").content.firstElementChild.cloneNode(true);
    const { kind, owner } = statusOf(avatar.id);
    const pending = state.pending.has(avatar.id);

    node.classList.add(`is-${kind}`);
    const img = node.querySelector("img");
    img.src = avatar.image;
    img.alt = `${avatar.name}, a pixel-art cosmonaut`;
    node.querySelector(".card__id").textContent = `#${String(avatar.id + 1).padStart(2, "0")}`;
    node.querySelector(".card__badge").textContent = { free: "Available", mine: "Yours", taken: "Claimed" }[kind];
    node.querySelector(".card__name").textContent = avatar.name;
    node.querySelector(".card__collection").textContent = avatar.collection;
    node.querySelector(".card__value").textContent = `${avatar.value} pts`;

    const ownerEl = node.querySelector(".card__owner");
    ownerEl.textContent = kind === "free" ? "—" : kind === "mine" ? "You" : short(owner);
    if (kind === "taken") ownerEl.title = owner;

    const btn = node.querySelector(".card__action");
    btn.dataset.id = avatar.id;
    if (pending) {
      btn.disabled = true;
      btn.classList.add("is-claim");
      btn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Confirming…';
    } else if (kind === "free") {
      btn.classList.add("is-claim");
      btn.textContent = "Claim";
      btn.setAttribute("aria-label", `Claim ${avatar.name}`);
    } else {
      btn.disabled = true;
      btn.classList.add(`is-${kind}`);
      btn.textContent = kind === "mine" ? "Owned by you" : "Not available";
    }
    return node;
  }

  function renderFilters() {
    const collections = ["All", ...new Set(state.avatars.map((a) => a.collection))];
    $("#filters").replaceChildren(...collections.map((name) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `chip${name === state.filter ? " is-active" : ""}`;
      chip.textContent = name;
      chip.dataset.filter = name;
      chip.setAttribute("aria-pressed", String(name === state.filter));
      return chip;
    }));
  }

  function bannerButton(label, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  }

  function renderBanner() {
    const banner = $("#modeBanner");
    const text = document.createElement("div");
    text.className = "banner__text";
    const strong = document.createElement("strong");
    const children = [text];

    if (state.mode === "demo") {
      banner.className = "banner";
      strong.textContent = "Demo mode";
      text.append(strong, ` — ${state.demoReason}. Claims are simulated in your browser so you can try the full flow.`);

      // Offer a one-click switch to a network where the contract is deployed.
      const target = Object.keys(DEPLOYMENTS)[0];
      if (window.ethereum && target && Number(target) !== state.chainId) {
        children.push(bannerButton(`Switch to ${chainName(target)}`, () => switchChain(target)));
      }
      children.push(bannerButton("Reset demo", resetDemo));
    } else {
      banner.className = "banner is-live";
      strong.textContent = `Live on ${chainName(state.chainId)}`;
      const address = state.contract.target;
      const explorer = CHAINS[state.chainId]?.explorer;
      text.append(strong, " — reading ownership from contract ");
      if (explorer) {
        const link = document.createElement("a");
        link.href = `${explorer}/address/${address}`;
        link.target = "_blank";
        link.rel = "noopener";
        link.className = "mono";
        link.textContent = short(address);
        text.append(link);
      } else {
        const code = document.createElement("span");
        code.className = "mono";
        code.textContent = short(address);
        text.append(code);
      }
      text.append(".");
    }
    banner.replaceChildren(...children);
    banner.hidden = false;
  }

  function renderWallet() {
    const btn = $("#walletButton");
    btn.classList.toggle("is-connected", state.mode === "live" && !!state.account);
    btn.classList.toggle("is-demo", state.mode === "demo");
    $("#walletLabel").textContent = state.mode === "demo"
      ? `Demo · ${short(state.account)}`
      : state.account ? short(state.account) : "Connect wallet";
  }

  function render() {
    const claimed = state.adopters.filter((a) => !same(a, ZERO)).length;
    const mine = state.avatars.filter((a) => statusOf(a.id).kind === "mine");

    $("#statAvailable").textContent = SUPPLY - claimed;
    $("#statClaimed").textContent = claimed;
    $("#ownedCount").textContent = mine.length;
    $("#ownedCount").hidden = mine.length === 0;
    $("#myAddress").textContent = state.account
      ? `${state.mode === "demo" ? "Demo wallet " : ""}${state.account}`
      : "No wallet connected";

    const visible = state.avatars.filter((a) =>
      (state.filter === "All" || a.collection === state.filter) &&
      (!state.onlyAvailable || statusOf(a.id).kind === "free"));
    $("#marketGrid").replaceChildren(...visible.map(buildCard));
    $("#marketEmpty").hidden = visible.length > 0;

    $("#collectionGrid").replaceChildren(...mine.map(buildCard));
    $("#collectionEmpty").hidden = mine.length > 0;

    renderWallet();
    renderBanner();
  }

  // ---------------------------------------------------------------- routing
  function route() {
    const view = location.hash === "#collection" ? "collection" : "market";
    $("#view-market").hidden = view !== "market";
    $("#view-collection").hidden = view !== "collection";
    document.querySelectorAll(".tabs__item").forEach((el) => {
      const active = el.dataset.viewLink === view;
      el.classList.toggle("is-active", active);
      if (active) el.setAttribute("aria-current", "page");
      else el.removeAttribute("aria-current");
    });
  }

  // ---------------------------------------------------------------- boot
  function bindEvents() {
    window.addEventListener("hashchange", () => { route(); window.scrollTo(0, 0); });
    $("#walletButton").addEventListener("click", onWalletClick);
    $("#onlyAvailable").addEventListener("change", (e) => {
      state.onlyAvailable = e.target.checked;
      render();
    });
    $("#filters").addEventListener("click", (e) => {
      const chip = e.target.closest("[data-filter]");
      if (!chip) return;
      state.filter = chip.dataset.filter;
      renderFilters();
      render();
    });
    // One delegated handler for every card, in both views.
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".card__action.is-claim:not(:disabled)");
      if (btn) claim(Number(btn.dataset.id));
    });

    if (window.ethereum?.on) {
      window.ethereum.on("chainChanged", () => location.reload());
      window.ethereum.on("accountsChanged", (accounts) => {
        if (state.mode !== "live") return;
        state.account = accounts[0] || null;
        render();
      });
    }
  }

  async function init() {
    bindEvents();
    route();

    const [avatars, localDeployments] = await Promise.all([
      fetch("avatar.json").then((r) => {
        if (!r.ok) throw new Error(`avatar.json: HTTP ${r.status}`);
        return r.json();
      }),
      loadLocalDeployments(),
    ]);
    state.avatars = avatars;
    renderFilters();

    await connectBackend(localDeployments);
    render();
    startPolling();
  }

  init().catch((err) => {
    console.error(err);
    toast("Something went wrong while loading the market.", "error");
  });
})();
