/* global Web3 */
(function (global) {
  "use strict";

  const WALLET_KEY = "popmartWalletConnected";
  const state = {
    web3: null,
    contract: null,
    account: null,
    chainId: null,
    networkId: null,
    networkName: "Unknown",
    role: "None",
  };
  let statusEl = null;
  let messageEl = null;

  function setMessage(message) {
    if (messageEl) {
      messageEl.textContent = message || "";
    }
  }

  function shortAddress(address) {
    if (!address) return "";
    return address.slice(0, 6) + "..." + address.slice(-4);
  }

  function networkLabel(chainId) {
    const map = {
      1: "Ethereum Mainnet",
      5: "Goerli",
      11155111: "Sepolia",
      1337: "Ganache",
      5777: "Ganache",
    };
    return map[chainId] || "Network";
  }

  function updateStatus() {
    if (!statusEl) return;
    const accountLabel = state.account ? shortAddress(state.account) : "Not connected";
    const roleLabel = state.role || "None";
    const networkLabelText = state.chainId
      ? state.networkName + " (" + state.chainId + ")"
      : "No network";
    statusEl.textContent =
      accountLabel + " · Role: " + roleLabel + " · " + networkLabelText;
  }

  function getProvider() {
    if (!global.ethereum) return null;
    if (Array.isArray(global.ethereum.providers)) {
      return global.ethereum.providers.find((p) => p.isMetaMask) || global.ethereum.providers[0];
    }
    return global.ethereum;
  }

  async function loadArtifact() {
    const res = await fetch("/build/PaymentEscrow.json", { cache: "no-store" });
    if (!res.ok) {
      throw new Error("Missing contract artifact: /build/PaymentEscrow.json");
    }
    return res.json();
  }

  function resolveAddress(artifact, networkId, chainId) {
    const networks = artifact.networks || {};
    const byNetwork = networks[String(networkId)];
    if (byNetwork && byNetwork.address) return byNetwork.address;
    const byChain = networks[String(chainId)];
    if (byChain && byChain.address) return byChain.address;
    const keys = Object.keys(networks);
    if (keys.length === 1 && networks[keys[0]].address) {
      return networks[keys[0]].address;
    }
    return null;
  }

  async function initContract() {
    const provider = getProvider();
    if (!provider) {
      throw new Error("MetaMask not detected.");
    }
    if (!state.web3) {
      state.web3 = new Web3(provider);
    }
    const artifact = await loadArtifact();
    state.networkId = await state.web3.eth.net.getId();
    state.chainId = await state.web3.eth.getChainId();
    state.networkName = networkLabel(state.chainId);
    const address = resolveAddress(artifact, state.networkId, state.chainId);
    if (!address) {
      throw new Error(
        "Contract not deployed on this network. Please deploy to this network (Ganache) and refresh."
      );
    }
    state.contract = new state.web3.eth.Contract(artifact.abi, address);
  }

  async function refreshRole() {
    if (!state.account || !state.contract) {
      state.role = "None";
      return;
    }
    try {
      const results = await Promise.all([
        state.contract.methods.getBuyerOrders(state.account).call(),
        state.contract.methods.getSellerOrders(state.account).call(),
      ]);
      const buyerOrders = results[0] || [];
      const sellerOrders = results[1] || [];
      const isBuyer = Array.isArray(buyerOrders) && buyerOrders.length > 0;
      const isSeller = Array.isArray(sellerOrders) && sellerOrders.length > 0;
      if (isBuyer && isSeller) {
        state.role = "Buyer/Seller";
      } else if (isSeller) {
        state.role = "Seller";
      } else if (isBuyer) {
        state.role = "Buyer";
      } else {
        state.role = "None";
      }
    } catch (err) {
      state.role = "None";
    }
  }

  async function refreshAccount(request) {
    const provider = getProvider();
    if (!provider) {
      throw new Error("MetaMask not detected.");
    }
    const accounts = await provider.request({
      method: request ? "eth_requestAccounts" : "eth_accounts",
    });
    state.account = accounts && accounts.length ? accounts[0] : null;
    await refreshRole();
    updateStatus();
    return state.account;
  }

  async function checkRole(requiredRole, options) {
    if (!requiredRole || requiredRole === "NONE") return true;
    if (!options || options.orderId == null) return true;
    const order = await state.contract.methods.getOrder(options.orderId).call();
    if (requiredRole === "BUYER") {
      return (
        order.buyer &&
        state.account &&
        order.buyer.toLowerCase() === state.account.toLowerCase()
      );
    }
    if (requiredRole === "SELLER") {
      return (
        order.seller &&
        state.account &&
        order.seller.toLowerCase() === state.account.toLowerCase()
      );
    }
    return true;
  }

  async function requireRole(requiredRole, options) {
    setMessage("");
    await initContract();
    if (!state.account) {
      await connect();
    }
    if (!state.account) {
      const error = new Error("Wallet not connected.");
      setMessage(error.message);
      throw error;
    }
    let ok = await checkRole(requiredRole, options);
    if (ok) return state.account;

    const roleLabel = requiredRole === "SELLER" ? "Seller" : "Buyer";
    const message =
      "Wrong account selected. Please switch MetaMask account to a " +
      roleLabel +
      " account.";
    setMessage(message);
    try {
      const provider = getProvider();
      await provider.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });
      await refreshAccount(true);
      ok = await checkRole(requiredRole, options);
    } catch (err) {
      // Ignore permission rejection.
    }
    if (!ok) {
      const error = new Error(message);
      throw error;
    }
    return state.account;
  }

  async function connect() {
    const account = await refreshAccount(true);
    if (account) {
      try {
        sessionStorage.setItem(WALLET_KEY, "true");
      } catch (err) {
        // Ignore storage errors.
      }
    }
    return account;
  }

  function disconnect() {
    state.account = null;
    state.role = "None";
    updateStatus();
    try {
      sessionStorage.removeItem(WALLET_KEY);
    } catch (err) {
      // Ignore storage errors.
    }
  }

  async function restoreSession() {
    let wantsReconnect = false;
    try {
      wantsReconnect = sessionStorage.getItem(WALLET_KEY) === "true";
    } catch (err) {
      // Ignore storage errors.
    }
    if (!wantsReconnect) return;
    await refreshAccount(false);
  }

  function bindProviderEvents() {
    const provider = getProvider();
    if (!provider || typeof provider.on !== "function") return;
    provider.on("accountsChanged", function () {
      refreshAccount(false).catch(function () {});
    });
    provider.on("chainChanged", function () {
      initContract()
        .then(function () { return refreshRole(); })
        .then(function () { updateStatus(); })
        .catch(function (err) {
          setMessage(err.message || "Network update failed.");
          updateStatus();
        });
    });
  }

  async function init(options) {
    statusEl = options && options.statusEl ? options.statusEl : null;
    messageEl = options && options.messageEl ? options.messageEl : null;
    try {
      await initContract();
    } catch (err) {
      setMessage(err.message || "Unable to load contract.");
    }
    await restoreSession();
    updateStatus();
    bindProviderEvents();
  }

  global.RoleManager = {
    init,
    connect,
    disconnect,
    requireRole,
    setMessage,
    getWeb3: function () { return state.web3; },
    getContract: function () { return state.contract; },
    getAccount: function () { return state.account; },
  };
})(window);
