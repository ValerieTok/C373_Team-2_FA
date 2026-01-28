/* global RoleManager */
(function () {
  "use strict";

  const walletBtn = document.getElementById("connectWalletBtn");
  const disconnectBtn = document.getElementById("disconnectWalletBtn");
  const statusEl = document.getElementById("walletIndicator");
  const messageEl = document.getElementById("walletMessage");
  const sellerWalletInputs = document.querySelectorAll('input[name="sellerWallet"]');
  let lastSellerWalletSync = "";

  function setMessage(message) {
    if (RoleManager && typeof RoleManager.setMessage === "function") {
      RoleManager.setMessage(message || "");
    } else if (messageEl) {
      messageEl.textContent = message || "";
    }
  }

  function getCart() {
    const cartEl = document.getElementById("cartData");
    if (!cartEl) return [];
    try {
      return JSON.parse(cartEl.textContent || "[]");
    } catch (err) {
      return [];
    }
  }

  function disableButton(button, isBusy) {
    if (!button) return;
    if (isBusy) {
      button.disabled = true;
      button.dataset.originalText = button.textContent || "";
      button.textContent = "Processing...";
    } else {
      button.disabled = false;
      button.textContent = button.dataset.originalText || button.textContent || "Submit";
    }
  }

  function applySellerWallet(account) {
    if (!sellerWalletInputs || !sellerWalletInputs.length) return;
    if (!account) return;
    sellerWalletInputs.forEach(function (input) {
      if (!input.value) {
        input.value = account;
      }
    });
  }

  async function syncSellerWallet(account) {
    if (!account || account === lastSellerWalletSync) return;
    lastSellerWalletSync = account;
    await fetch("/seller/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "sellerWallet=" + encodeURIComponent(account),
    });
  }

  async function handleCheckout(form) {
    const cart = getCart();
    if (!cart.length) {
      throw new Error("Your cart is empty.");
    }
    const buyerName = form.querySelector("[name=buyerName]").value;
    const buyerEmail = form.querySelector("[name=buyerEmail]").value;
    const buyerAddress = form.querySelector("[name=buyerAddress]").value;

    const account = await RoleManager.requireRole("BUYER");
    const web3 = RoleManager.getWeb3();
    const contract = RoleManager.getContract();
    const chainOrders = [];
    const orderReceipts = [];
    const chainId = Number(await web3.eth.getChainId());

    for (const item of cart) {
      if (!item.sellerWallet) {
        throw new Error("Missing seller wallet for " + item.name + ".");
      }
      if (!web3.utils.isAddress(item.sellerWallet)) {
        throw new Error("Seller wallet must be a valid address for " + item.name + ".");
      }
      const qty = Number(item.qty || 0);
      const unitPriceWei = web3.utils.toWei(String(item.priceEth || 0), "ether");
      const totalWei = web3.utils
        .toBN(unitPriceWei)
        .mul(web3.utils.toBN(qty))
        .toString();
      const expectedOrderId = await contract.methods.nextOrderId().call();
      const receipt = await contract.methods
        .createOrder(item.sellerWallet, item.productId, qty, unitPriceWei)
        .send({ from: account, value: totalWei });
      const orderHash = web3.utils.soliditySha3(
        { type: "address", value: account },
        { type: "address", value: item.sellerWallet },
        { type: "uint256", value: item.productId },
        { type: "uint256", value: qty },
        { type: "uint256", value: unitPriceWei },
        { type: "uint256", value: expectedOrderId },
        { type: "uint256", value: chainId }
      );
      const notarizeReceipt = await contract.methods
        .notarizePurchase(orderHash, item.productId, qty, unitPriceWei)
        .send({ from: account });
      chainOrders.push({
        orderId: String(expectedOrderId),
        txHash: receipt.transactionHash,
      });
      orderReceipts.push({
        orderHash: orderHash,
        escrowOrderId: String(expectedOrderId),
        notarizeTxHash: notarizeReceipt.transactionHash,
      });
    }

    const response = await fetch(form.action, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        buyerName: buyerName,
        buyerEmail: buyerEmail,
        buyerAddress: buyerAddress,
        buyerWallet: account,
        chainOrders: chainOrders,
        orderReceipts: orderReceipts,
      }),
    });
    const payload = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      throw new Error(payload.message || "Checkout failed.");
    }
    window.location.href = payload.redirect || "/buyer";
  }

  async function handleEscrowAction(form) {
    const action = form.dataset.escrowAction;
    const escrowOrderId = form.dataset.escrowOrderId;
    if (!escrowOrderId) {
      throw new Error("Escrow order ID missing.");
    }
    const requiredRole = action === "ship" ? "SELLER" : "BUYER";
    const account = await RoleManager.requireRole(requiredRole, { orderId: escrowOrderId });
    const expectedWallet = (form.dataset.expectedWallet || "").toLowerCase();
    if (expectedWallet && account && account.toLowerCase() !== expectedWallet) {
      throw new Error("Wrong account selected. Please switch MetaMask account.");
    }
    const contract = RoleManager.getContract();

    if (action === "ship") {
      await contract.methods.confirmShipment(escrowOrderId).send({ from: account });
    } else if (action === "deliver") {
      await contract.methods.confirmDelivery(escrowOrderId).send({ from: account });
      await contract.methods.releasePayment(escrowOrderId).send({ from: account });
    } else if (action === "rate") {
      const stars = Number(form.querySelector("[name=stars]").value || 5);
      const comment = form.querySelector("[name=comment]").value || "";
      await contract.methods
        .submitRating(escrowOrderId, stars, comment)
        .send({ from: account });
    }

    const payload =
      action === "rate"
        ? {
            stars: form.querySelector("[name=stars]").value,
            comment: form.querySelector("[name=comment]").value,
          }
        : {};

    const response = await fetch(form.action, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorPayload = await response.json().catch(function () { return {}; });
      throw new Error(errorPayload.message || "Server update failed.");
    }
    window.location.reload();
  }

  function bindCheckout() {
    const form = document.querySelector("[data-escrow-checkout]");
    if (!form) return;
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const submitBtn = form.querySelector("button[type=submit]");
      disableButton(submitBtn, true);
      handleCheckout(form)
        .catch(function (err) {
          setMessage(err.message || "Checkout failed.");
          alert(err.message || "Checkout failed.");
        })
        .finally(function () {
          disableButton(submitBtn, false);
        });
    });
  }

  function bindEscrowActions() {
    const forms = document.querySelectorAll("form[data-escrow-action]");
    forms.forEach(function (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        const submitBtn = form.querySelector("button[type=submit]");
        disableButton(submitBtn, true);
        handleEscrowAction(form)
          .catch(function (err) {
            setMessage(err.message || "Transaction failed.");
            alert(err.message || "Transaction failed.");
          })
          .finally(function () {
            disableButton(submitBtn, false);
        });
      });
    });
  }

  if (RoleManager) {
    RoleManager.init({ statusEl: statusEl, messageEl: messageEl }).then(function () {
      const account = RoleManager.getAccount();
      applySellerWallet(account);
      syncSellerWallet(account).catch(function () {});
    });
  }

  if (walletBtn) {
    walletBtn.addEventListener("click", function () {
      RoleManager.connect().catch(function (err) {
        setMessage(err.message || "Unable to connect wallet.");
        alert(err.message || "Unable to connect wallet.");
      }).then(function () {
        const account = RoleManager.getAccount();
        applySellerWallet(account);
        syncSellerWallet(account).catch(function () {});
      });
    });
  }

  if (disconnectBtn) {
    disconnectBtn.addEventListener("click", function () {
      RoleManager.disconnect();
    });
  }

  if (window.ethereum && typeof window.ethereum.on === "function") {
    window.ethereum.on("accountsChanged", function (accounts) {
      const account = accounts && accounts.length ? accounts[0] : "";
      applySellerWallet(account);
      syncSellerWallet(account).catch(function () {});
    });
  }

  bindCheckout();
  bindEscrowActions();
})();
