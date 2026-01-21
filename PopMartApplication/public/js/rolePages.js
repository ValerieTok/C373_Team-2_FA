/* global Web3 */

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

async function loadArtifact(name) {
  const res = await fetch(`/build/${name}.json`);
  if (!res.ok) {
    throw new Error(`Missing artifact: ${name}`);
  }
  return res.json();
}

function getQueryText(key) {
  const params = new URLSearchParams(window.location.search);
  const val = params.get(key);
  return val && String(val).trim() ? String(val).trim() : null;
}

function getQueryNumber(key) {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get(key);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function preferOrderIdFromUrlOrStorage(stored) {
  const urlOrderId = getQueryNumber("orderId");
  if (urlOrderId !== null) return urlOrderId;
  const storedId = loadStoredOrderId() ?? (stored ? stored.orderId : null);
  return storedId !== undefined ? storedId : null;
}

function status(id, message) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = message;
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
  }
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.value = value;
  }
}

function setDisabled(id, disabled) {
  const el = document.getElementById(id);
  if (el) {
    el.disabled = !!disabled;
  }
}

function renderStars(containerId, value) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const stars = el.querySelectorAll(".star");
  const rating = Number(value);
  const filled = Number.isFinite(rating) ? Math.round(rating) : 0;
  stars.forEach((star, index) => {
    if (index < filled) {
      star.classList.add("filled");
    } else {
      star.classList.remove("filled");
    }
  });
}

function getInputNumber(id) {
  const el = document.getElementById(id);
  if (!el || !el.value) return null;
  const parsed = Number(el.value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getInputText(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  const value = (el.value || "").trim();
  return value || null;
}

function isEmptyOrder(order) {
  return (
    !order ||
    (order.buyer === ZERO_ADDRESS &&
      order.seller === ZERO_ADDRESS &&
      String(order.amountWei || "0") === "0")
  );
}

function loadStoredOrderContext() {
  if (!window.localStorage) return null;
  try {
    const raw = localStorage.getItem("popmartLastOrder");
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function getProductFromRoot(root) {
  if (!root || !root.dataset) return null;
  const product = {
    id: root.dataset.productId,
    name: root.dataset.productName,
    category: root.dataset.productCategory,
    sellerName: root.dataset.productSeller,
    desc: root.dataset.productDesc,
    image: root.dataset.productImage,
    priceEth: root.dataset.productPrice,
  };
  if (!product.id) return null;
  return product;
}

function loadStoredOrderId() {
  if (!window.localStorage) return null;
  const raw = localStorage.getItem("popmartLastOrderId");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function storeOrderId(orderId) {
  if (!window.localStorage) return;
  if (orderId !== null && orderId !== undefined) {
    localStorage.setItem("popmartLastOrderId", String(orderId));
  }
}

function formatFlags(order) {
  return [
    `Shipped: ${order.shipped}`,
    `Delivered: ${order.delivered}`,
    `Paid out: ${order.paidOut}`,
    `Rated: ${order.rated}`,
  ].join(" | ");
}

function applyProductDetails(prefix, product) {
  if (product) {
    setText(`${prefix}ProductName`, product.name || "Selected Product");
    setText(`${prefix}ProductCategory`, product.category || "Not available");
    setText(
      `${prefix}ProductSellerName`,
      product.sellerName ? `Seller: ${product.sellerName}` : "Seller: Not available"
    );
    setText(`${prefix}ProductDesc`, product.desc || "Product details loaded from your last order.");
    setText(`${prefix}ProductPrice`, product.priceEth || "0.00");
    const img = document.getElementById(`${prefix}ProductImage`);
    if (img && product.image) {
      img.src = product.image;
    }
    return;
  }
  setText(`${prefix}ProductName`, "Selected Product");
  setText(`${prefix}ProductCategory`, "Not available");
  setText(`${prefix}ProductSellerName`, "Seller: Not available");
  setText(`${prefix}ProductDesc`, "Product details are not available on-chain.");
  setText(`${prefix}ProductPrice`, "0.00");
}

async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("MetaMask not found");
  }
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  if (!accounts || !accounts.length) {
    throw new Error("No accounts returned");
  }
  return accounts[0];
}

async function getActiveAccount() {
  if (!window.ethereum) {
    return null;
  }
  const accounts = await window.ethereum.request({ method: "eth_accounts" });
  return accounts && accounts.length ? accounts[0] : null;
}

async function requireMatchingAccount(expected, statusId, roleLabel) {
  const active = (await getActiveAccount()) || (await connectWallet());
  if (!active) {
    status(statusId, "Connect MetaMask first.");
    return null;
  }
  if (expected && active.toLowerCase() !== expected.toLowerCase()) {
    status(statusId, `Switch MetaMask to the ${roleLabel} account (${expected}).`);
    return null;
  }
  return active;
}

async function getContracts(web3) {
  const [escrowArtifact, repArtifact] = await Promise.all([
    loadArtifact("EscrowPayment"),
    loadArtifact("SellerReputation"),
  ]);

  const networkId = await web3.eth.net.getId();
  if (Number(networkId) === 1) {
    throw new Error(
      "You are on Ethereum Mainnet (network 1). Switch MetaMask to Ganache/Localhost (RPC http://127.0.0.1:7545), then refresh."
    );
  }

  const escrowInfo = escrowArtifact.networks[networkId];
  const repInfo = repArtifact.networks[networkId];

  if (!escrowInfo || !escrowInfo.address) {
    throw new Error(`EscrowPayment not deployed on network ${networkId}`);
  }
  if (!repInfo || !repInfo.address) {
    throw new Error(`SellerReputation not deployed on network ${networkId}`);
  }

  return {
    escrow: new web3.eth.Contract(escrowArtifact.abi, escrowInfo.address),
    reputation: new web3.eth.Contract(repArtifact.abi, repInfo.address),
  };
}

async function refreshRatingSnapshot(reputation, seller, avgId, countId) {
  const [avgTimes100, count] = await Promise.all([
    reputation.methods.getAverageRating(seller).call(),
    reputation.methods.ratingCount(seller).call(),
  ]);
  const avg = Number(avgTimes100) / 100;
  status(avgId, Number.isFinite(avg) ? avg.toFixed(2) : "0.00");
  status(countId, count);
  renderStars("sellerAvgRatingStars", avg);
}

async function findLatestOrder(escrow, address, role) {
  if (!address) return null;
  const nextId = await escrow.methods.nextOrderId().call();
  const total = Number(nextId);
  if (!Number.isFinite(total) || total <= 0) return null;
  let fallback = null;
  for (let id = total - 1; id >= 0; id -= 1) {
    const order = await escrow.methods.getOrder(id).call();
    if (!order) continue;
    const match = role === "seller" ? order.seller : order.buyer;
    if (!match || match.toLowerCase() !== address.toLowerCase()) continue;
    const amountWei = BigInt(order.amountWei || 0);
    if (amountWei > 0n) {
      return { id, order };
    }
    if (!fallback) {
      fallback = { id, order };
    }
  }
  return fallback;
}

async function loadLatestRating(reputation, seller) {
  try {
    const events = await reputation.getPastEvents("SellerRated", {
      filter: { seller },
      fromBlock: 0,
      toBlock: "latest",
    });
    if (!events || !events.length) return null;
    const last = events[events.length - 1];
    return {
      stars: last.returnValues?.stars,
      comment: last.returnValues?.comment,
      orderId: last.returnValues?.orderId,
    };
  } catch (_) {
    return null;
  }
}

function updateBuyerButtons(order) {
  if (!order) {
    setDisabled("buyerDeliver", true);
    setDisabled("buyerRate", true);
    return;
  }
  setDisabled("buyerDeliver", !order.shipped || order.delivered || order.paidOut);
  setDisabled("buyerRate", !order.paidOut || order.rated);
}

function updateSellerButtons(order) {
  if (!order) {
    setDisabled("sellerShip", true);
    setDisabled("sellerRelease", true);
    return;
  }
  setDisabled("sellerShip", order.shipped || order.paidOut);
  setDisabled("sellerRelease", !order.shipped || !order.delivered || order.paidOut);
}

function updateOrderSummary(prefix, orderId, order) {
  if (!order) {
    setText(`${prefix}OrderId`, "Not loaded");
    setText(`${prefix}OrderBuyer`, "-");
    setText(`${prefix}OrderSeller`, "-");
    setText(`${prefix}OrderAmount`, "-");
    setText(`${prefix}OrderFlags`, "-");
    return;
  }
  setText(`${prefix}OrderId`, String(orderId));
  setText(`${prefix}OrderBuyer`, order.buyer);
  setText(`${prefix}OrderSeller`, order.seller);
  setText(`${prefix}OrderAmount`, order.amountWei);
  setText(`${prefix}OrderFlags`, formatFlags(order));
}

async function initBuyerPage() {
  const root = document.getElementById("buyerPage");
  if (!root) return;

  const stored = loadStoredOrderContext();
  const urlProductId = getQueryText("productId");
  // SAVE ACTIVE PRODUCT CONTEXT (so "View Product" doesn't jump to Labubu)
  if (urlProductId) {
    try {
      localStorage.setItem("popmartActiveProductId", String(urlProductId));
    } catch (e) {}
  }
  // Prefer product coming from URL productId if available
  let product = getProductFromRoot(root);

  if (!product && urlProductId) {
    // if you have a product list in localStorage, you could load it here.
    // For now: if stored product matches the id, use it, else don't override.
    if (stored && stored.product && String(stored.product.id) === String(urlProductId)) {
      product = stored.product;
    } else {
      // At minimum, prevent showing a WRONG product from last order:
      product = { id: urlProductId, name: "Selected Product", desc: "Loaded from URL (productId).", priceEth: "" };
    }
  }

  if (!product && stored) product = stored.product;

  applyProductDetails("buyer", product);

  applyProductDetails("buyer", product);

  if (stored && stored.sellerAddress) {
    setValue("buyerSellerAddress", stored.sellerAddress);
  }
  if (product && product.priceEth) {
    setValue("buyerAmountEth", product.priceEth);
  }

  if (!window.ethereum) {
    status("buyerBuyStatus", "MetaMask not detected.");
    return;
  }

  const web3 = new Web3(window.ethereum);
  let escrow;
  let reputation;
  try {
    const contracts = await getContracts(web3);
    escrow = contracts.escrow;
    reputation = contracts.reputation;
  } catch (err) {
    status("buyerBuyStatus", err.message);
    return;
  }

  const storedOrderId = preferOrderIdFromUrlOrStorage(stored);
  let loadedFromStored = false;
  if (storedOrderId !== null) {
    setValue("buyerOrderIdInput", storedOrderId);
    try {
      const order = await escrow.methods.getOrder(storedOrderId).call();
      if (!isEmptyOrder(order)) {
        updateOrderSummary("buyer", storedOrderId, order);
        updateBuyerButtons(order);
        status("buyerOrderStatus", `Loaded order ${storedOrderId}.`);
        if (order.seller) {
          await refreshRatingSnapshot(reputation, order.seller, "buyerAvgRating", "buyerRatingCount");
        }
        loadedFromStored = true;
      }
    } catch (err) {
      status("buyerOrderStatus", err.message);
    }
  }

  const active = await getActiveAccount();
  if (!active) {
    status("buyerOrderStatus", "Connect MetaMask to load your latest order.");
  } else if (!loadedFromStored) {
    try {
      const latest = await findLatestOrder(escrow, active, "buyer");
      if (latest && latest.order) {
        setValue("buyerOrderIdInput", latest.id);
        updateOrderSummary("buyer", latest.id, latest.order);
        updateBuyerButtons(latest.order);
        status("buyerOrderStatus", `Loaded latest order ${latest.id}.`);
        await refreshRatingSnapshot(reputation, latest.order.seller, "buyerAvgRating", "buyerRatingCount");
        storeOrderId(latest.id);
      } else {
        status("buyerOrderStatus", "No orders found for this buyer.");
      }
    } catch (err) {
      status("buyerOrderStatus", err.message);
    }
  }

  const loadBtn = document.getElementById("buyerLoadOrder");
  if (loadBtn) {
    loadBtn.addEventListener("click", async () => {
      try {
        const orderId = getInputNumber("buyerOrderIdInput");
        if (orderId === null) {
          status("buyerOrderStatus", "Enter a valid order id.");
          return;
        }
        const order = await escrow.methods.getOrder(orderId).call();
        if (isEmptyOrder(order)) {
          status("buyerOrderStatus", "Order not found.");
          updateOrderSummary("buyer", orderId, null);
          updateBuyerButtons(null);
          return;
        }
        updateOrderSummary("buyer", orderId, order);
        updateBuyerButtons(order);
        status("buyerOrderStatus", `Loaded order ${orderId}.`);
        if (order.seller) {
          await refreshRatingSnapshot(reputation, order.seller, "buyerAvgRating", "buyerRatingCount");
        }
        storeOrderId(orderId);
      } catch (err) {
        status("buyerOrderStatus", err.message);
      }
    });
  }

  const buyBtn = document.getElementById("buyerBuy");
  if (buyBtn) {
    buyBtn.addEventListener("click", async () => {
      try {
        const sellerAddress = getInputText("buyerSellerAddress");
        if (!sellerAddress) {
          status("buyerBuyStatus", "Enter a seller wallet address.");
          return;
        }
        const amountEth = getInputText("buyerAmountEth");
        if (!amountEth || Number(amountEth) <= 0) {
          status("buyerBuyStatus", "Enter a valid amount in ETH.");
          return;
        }
        const buyer = await connectWallet();
        status("buyerBuyStatus", "Creating order...");
        const receipt = await escrow.methods
          .createOrder(sellerAddress)
          .send({ from: buyer, value: web3.utils.toWei(String(amountEth), "ether") });
        let orderId = null;
        if (receipt && receipt.events && receipt.events.OrderCreated) {
          const value = receipt.events.OrderCreated.returnValues?.orderId;
          if (value !== undefined && value !== null) {
            orderId = Number(value);
          }
        }
        if (orderId === null) {
          const nextId = await escrow.methods.nextOrderId().call();
          orderId = Number(nextId) - 1;
        }
        if (Number.isFinite(orderId)) {
          setValue("buyerOrderIdInput", orderId);
          storeOrderId(orderId);
        }
        status("buyerBuyStatus", `Order created (ID: ${orderId}). Tx: ${receipt.transactionHash}`);
        const order = await escrow.methods.getOrder(orderId).call();
        updateOrderSummary("buyer", orderId, order);
        updateBuyerButtons(order);
      } catch (err) {
        status("buyerBuyStatus", err.message);
      }
    });
  }

  const deliverBtn = document.getElementById("buyerDeliver");
  if (deliverBtn) {
    deliverBtn.addEventListener("click", async () => {
      try {
        const orderId = getInputNumber("buyerOrderIdInput");
        if (orderId === null) {
          status("buyerDeliverStatus", "Enter a valid order id.");
          return;
        }
        const order = await escrow.methods.getOrder(orderId).call();
        const account = await requireMatchingAccount(order.buyer, "buyerDeliverStatus", "buyer");
        if (!account) return;
        status("buyerDeliverStatus", "Confirming delivery...");
        const receipt = await escrow.methods.confirmDelivery(orderId).send({ from: account });
        status("buyerDeliverStatus", `Delivery confirmed. Tx: ${receipt.transactionHash}`);
        const refreshed = await escrow.methods.getOrder(orderId).call();
        updateOrderSummary("buyer", orderId, refreshed);
        updateBuyerButtons(refreshed);
      } catch (err) {
        status("buyerDeliverStatus", err.message);
      }
    });
  }

  const rateBtn = document.getElementById("buyerRate");
  if (rateBtn) {
    rateBtn.addEventListener("click", async () => {
      try {
        const orderId = getInputNumber("buyerOrderIdInput");
        if (orderId === null) {
          status("buyerRateStatus", "Enter a valid order id.");
          return;
        }
        const stars = Number(getInputText("buyerStars") || 0);
        const comment = getInputText("buyerComment") || "";
        const order = await escrow.methods.getOrder(orderId).call();
        if (!order.paidOut) {
          status("buyerRateStatus", "Payment has not been released yet.");
          return;
        }
        const account = await requireMatchingAccount(order.buyer, "buyerRateStatus", "buyer");
        if (!account) return;
        status("buyerRateStatus", "Submitting rating...");
        const receipt = await escrow.methods
          .submitRating(orderId, stars, comment)
          .send({ from: account });
        status("buyerRateStatus", `Rating submitted. Tx: ${receipt.transactionHash}`);
        const refreshed = await escrow.methods.getOrder(orderId).call();
        updateOrderSummary("buyer", orderId, refreshed);
        updateBuyerButtons(refreshed);
        if (order.seller) {
          await refreshRatingSnapshot(reputation, order.seller, "buyerAvgRating", "buyerRatingCount");
        }
      } catch (err) {
        status("buyerRateStatus", err.message);
      }
    });
  }
}

async function initSellerPage() {
  const root = document.getElementById("sellerPage");
  if (!root) return;

  const stored = loadStoredOrderContext();
  const urlProductId = getQueryText("productId");

    // SAVE ACTIVE PRODUCT CONTEXT (so "View Product" doesn't jump to Labubu)
  if (urlProductId) {
    try {
      localStorage.setItem("popmartActiveProductId", String(urlProductId));
    } catch (e) {}
  }

  if (urlProductId) {
    const mappedOrderId = localStorage.getItem(
      `popmartOrderByProduct_${urlProductId}`
    );
    if (mappedOrderId) {
      setValue("buyerOrderIdInput", mappedOrderId);
    }
  }


  // Prefer product coming from URL productId if available
  let product = getProductFromRoot(root);

  if (!product && urlProductId) {
    // if you have a product list in localStorage, you could load it here.
    // For now: if stored product matches the id, use it, else don't override.
    if (stored && stored.product && String(stored.product.id) === String(urlProductId)) {
      product = stored.product;
    } else {
      // At minimum, prevent showing a WRONG product from last order:
      product = { id: urlProductId, name: "Selected Product", desc: "Loaded from URL (productId).", priceEth: "" };
    }
  }

  if (!product && stored) product = stored.product;

  applyProductDetails("buyer", product);

  applyProductDetails("seller", product);

  if (!window.ethereum) {
    status("sellerShipStatus", "MetaMask not detected.");
    return;
  }

  const web3 = new Web3(window.ethereum);
  let escrow;
  let reputation;
  try {
    const contracts = await getContracts(web3);
    escrow = contracts.escrow;
    reputation = contracts.reputation;
  } catch (err) {
    status("sellerShipStatus", err.message);
    return;
  }

  const storedOrderId = preferOrderIdFromUrlOrStorage(stored);
  let loadedFromStored = false;
  if (storedOrderId !== null) {
    setValue("sellerOrderIdInput", storedOrderId);
    try {
      const order = await escrow.methods.getOrder(storedOrderId).call();
      if (!isEmptyOrder(order)) {
        updateOrderSummary("seller", storedOrderId, order);
        updateSellerButtons(order);
        status("sellerOrderStatus", `Loaded order ${storedOrderId}.`);
        if (order.seller) {
          await refreshRatingSnapshot(reputation, order.seller, "sellerAvgRating", "sellerRatingCount");
          const latest = await loadLatestRating(reputation, order.seller);
          if (latest) {
            setText("sellerLatestRatingStars", latest.stars || "-");
            setText("sellerLatestRatingComment", latest.comment || "No comment provided.");
            setText("sellerLatestRatingOrder", latest.orderId || "-");
            renderStars("sellerLatestRatingStarsDisplay", latest.stars || 0);
          }
        }
        loadedFromStored = true;
      }
    } catch (err) {
      status("sellerOrderStatus", err.message);
    }
  }

  const active = await getActiveAccount();
  if (!active) {
    status("sellerOrderStatus", "Connect MetaMask to load your latest order.");
  } else if (!loadedFromStored) {
    try {
      const latest = await findLatestOrder(escrow, active, "seller");
      if (latest && latest.order) {
        setValue("sellerOrderIdInput", latest.id);
        updateOrderSummary("seller", latest.id, latest.order);
        updateSellerButtons(latest.order);
        status("sellerOrderStatus", `Loaded latest order ${latest.id}.`);
        await refreshRatingSnapshot(reputation, latest.order.seller, "sellerAvgRating", "sellerRatingCount");
        const latestRating = await loadLatestRating(reputation, latest.order.seller);
        if (latestRating) {
          setText("sellerLatestRatingStars", latestRating.stars || "-");
          setText("sellerLatestRatingComment", latestRating.comment || "No comment provided.");
          setText("sellerLatestRatingOrder", latestRating.orderId || "-");
          renderStars("sellerLatestRatingStarsDisplay", latestRating.stars || 0);
        }
        storeOrderId(latest.id);
      } else {
        status("sellerOrderStatus", "No orders found for this seller.");
      }
    } catch (err) {
      status("sellerOrderStatus", err.message);
    }
  }

  const loadBtn = document.getElementById("sellerLoadOrder");
  if (loadBtn) {
    loadBtn.addEventListener("click", async () => {
      try {
        const orderId = getInputNumber("sellerOrderIdInput");
        if (orderId === null) {
          status("sellerOrderStatus", "Enter a valid order id.");
          return;
        }
        const order = await escrow.methods.getOrder(orderId).call();
        if (isEmptyOrder(order)) {
          status("sellerOrderStatus", "Order not found.");
          updateOrderSummary("seller", orderId, null);
          updateSellerButtons(null);
          return;
        }
        updateOrderSummary("seller", orderId, order);
        updateSellerButtons(order);
        status("sellerOrderStatus", `Loaded order ${orderId}.`);
        if (order.seller) {
          await refreshRatingSnapshot(reputation, order.seller, "sellerAvgRating", "sellerRatingCount");
          const latestRating = await loadLatestRating(reputation, order.seller);
          if (latestRating) {
            setText("sellerLatestRatingStars", latestRating.stars || "-");
            setText("sellerLatestRatingComment", latestRating.comment || "No comment provided.");
            setText("sellerLatestRatingOrder", latestRating.orderId || "-");
            renderStars("sellerLatestRatingStarsDisplay", latestRating.stars || 0);
          }
        }
        storeOrderId(orderId);
      } catch (err) {
        status("sellerOrderStatus", err.message);
      }
    });
  }

  const shipBtn = document.getElementById("sellerShip");
  if (shipBtn) {
    shipBtn.addEventListener("click", async () => {
      try {
        const orderId = getInputNumber("sellerOrderIdInput");
        if (orderId === null) {
          status("sellerShipStatus", "Enter a valid order id.");
          return;
        }
        const order = await escrow.methods.getOrder(orderId).call();
        const account = await requireMatchingAccount(order.seller, "sellerShipStatus", "seller");
        if (!account) return;
        status("sellerShipStatus", "Confirming shipment...");
        const receipt = await escrow.methods.confirmShipment(orderId).send({ from: account });
        status("sellerShipStatus", `Shipment confirmed. Tx: ${receipt.transactionHash}`);
        const refreshed = await escrow.methods.getOrder(orderId).call();
        updateOrderSummary("seller", orderId, refreshed);
        updateSellerButtons(refreshed);
      } catch (err) {
        status("sellerShipStatus", err.message);
      }
    });
  }

  const releaseBtn = document.getElementById("sellerRelease");
  if (releaseBtn) {
    releaseBtn.addEventListener("click", async () => {
      try {
        const orderId = getInputNumber("sellerOrderIdInput");
        if (orderId === null) {
          status("sellerReleaseStatus", "Enter a valid order id.");
          return;
        }
        const order = await escrow.methods.getOrder(orderId).call();
        const account = await requireMatchingAccount(order.seller, "sellerReleaseStatus", "seller");
        if (!account) return;
        if (!order.shipped) {
          status("sellerReleaseStatus", "Shipment must be confirmed first.");
          return;
        }
        if (!order.delivered) {
          status("sellerReleaseStatus", "Buyer must confirm delivery first.");
          return;
        }
        if (order.paidOut) {
          status("sellerReleaseStatus", "Payment already released.");
          return;
        }
        status("sellerReleaseStatus", "Releasing payment...");
        const receipt = await escrow.methods.releasePayment(orderId).send({ from: account });
        status("sellerReleaseStatus", `Payment released. Tx: ${receipt.transactionHash}`);
        const refreshed = await escrow.methods.getOrder(orderId).call();
        updateOrderSummary("seller", orderId, refreshed);
        updateSellerButtons(refreshed);
      } catch (err) {
        status("sellerReleaseStatus", err.message);
      }
    });
  }
}

window.addEventListener("load", () => {
  initBuyerPage().catch((err) => {
    status("buyerBuyStatus", err.message);
  });
  initSellerPage().catch((err) => {
    status("sellerShipStatus", err.message);
  });
});
