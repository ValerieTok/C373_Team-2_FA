/* global Web3 */

async function loadArtifact(name) {
  const res = await fetch(`/build/${name}.json`);
  if (!res.ok) {
    throw new Error(`Missing artifact: ${name}`);
  }
  return res.json();
}

function status(id, message) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = message;
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

function requireOrderId() {
  const input = document.getElementById("orderId");
  if (!input || !input.value) return null;
  const parsed = Number(input.value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getSellerAddress() {
  const input = document.getElementById("sellerAddress");
  if (!input) return null;
  const value = (input.value || "").trim();
  return value || null;
}

function storeOrderContext(orderId, product, sellerAddress) {
  if (!window.localStorage) return;
  const payload = {
    orderId,
    product,
    sellerAddress,
    savedAt: Date.now(),
  };
  localStorage.setItem("popmartLastOrder", JSON.stringify(payload));
  if (orderId !== null && orderId !== undefined) {
    localStorage.setItem("popmartLastOrderId", String(orderId));
  }
}

function sellerKey(productId) {
  return `popmartSellerByProduct_${productId}`;
}

function storeSellerForProduct(productId, sellerAddress) {
  if (!window.localStorage || !productId || !sellerAddress) return;
  localStorage.setItem(sellerKey(productId), sellerAddress);
}

function getStoredSeller(productId) {
  if (!window.localStorage || !productId) return null;
  const value = localStorage.getItem(sellerKey(productId));
  return value ? value.trim() : null;
}

function getProductFromButton(btn) {
  if (!btn) return null;
  const product = {
    id: btn.getAttribute("data-product-id"),
    name: btn.getAttribute("data-product-name"),
    category: btn.getAttribute("data-product-category"),
    sellerName: btn.getAttribute("data-product-seller"),
    desc: btn.getAttribute("data-product-desc"),
    image: btn.getAttribute("data-product-image"),
    priceEth: btn.getAttribute("data-price"),
  };
  return product;
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
    throw new Error("MetaMask not found");
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
    status(
      statusId,
      `Switch MetaMask to the ${roleLabel} account (${expected}).`
    );
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

async function refreshRating(reputation, seller) {
  const [avgTimes100, count] = await Promise.all([
    reputation.methods.getAverageRating(seller).call(),
    reputation.methods.ratingCount(seller).call(),
  ]);
  const avg = Number(avgTimes100) / 100;
  status("avgRating", Number.isFinite(avg) ? avg.toFixed(2) : "0.00");
  status("ratingCount", count);
  renderStars("avgRatingStars", avg);
}

async function refreshOrderStatus(escrow, orderId) {
  try {
    const order = await escrow.methods.getOrder(orderId).call();
    const lines = [
      `Buyer: ${order.buyer}`,
      `Seller: ${order.seller}`,
      `Amount (wei): ${order.amountWei}`,
      `Shipped: ${order.shipped}`,
      `Delivered: ${order.delivered}`,
      `Paid out: ${order.paidOut}`,
      `Rated: ${order.rated}`,
    ];
    status("orderStatus", lines.join(" | "));
  } catch (err) {
    status("orderStatus", err.message);
  }
}

async function init() {
  const buyBtn = document.getElementById("btnBuy");
  const shipBtn = document.getElementById("btnShip");
  const deliverBtn = document.getElementById("btnDeliver");
  const releaseBtn = document.getElementById("btnRelease");
  const rateBtn = document.getElementById("btnRate");

  if (!buyBtn) return;

  const productId = buyBtn.getAttribute("data-product-id");
  const sellerInput = document.getElementById("sellerAddress");
  if (sellerInput && productId) {
    const storedSeller = getStoredSeller(productId);
    if (!sellerInput.value && storedSeller) {
      sellerInput.value = storedSeller;
    }
  }

  let seller = getSellerAddress();
  const priceEth = buyBtn.getAttribute("data-price");

  // 1) Force MetaMask to connect immediately
  await connectWallet();

  // 2) Now MetaMask has an active provider context for this site
  const web3 = new Web3(window.ethereum);

  // 3) Now load contracts (netId should be Ganache, not 1)
  const { escrow, reputation } = await getContracts(web3);

  if (seller) {
    await refreshRating(reputation, seller);
  }

  if (sellerInput) {
    sellerInput.addEventListener("change", () => {
      seller = getSellerAddress();
      if (seller) {
        storeSellerForProduct(productId, seller);
        refreshRating(reputation, seller).catch(() => {});
      }
    });
  }

  buyBtn.addEventListener("click", async () => {
    try {
      const buyer = await connectWallet();
      seller = getSellerAddress();
      if (!seller) {
        status("buyStatus", "Enter a seller wallet address.");
        return;
      }
      storeSellerForProduct(productId, seller);
      status("buyStatus", "Creating order...");
      const receipt = await escrow.methods
        .createOrder(seller)
        .send({ from: buyer, value: web3.utils.toWei(String(priceEth), "ether") });
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
      const orderInput = document.getElementById("orderId");
      if (orderInput && Number.isFinite(orderId)) {
        orderInput.value = String(orderId);
      }
      if (Number.isFinite(orderId)) {
      const product = getProductFromButton(buyBtn);
      if (product && product.id && Number.isFinite(orderId)) {
        localStorage.setItem(`popmartOrderByProduct_${product.id}`, String(orderId));
      }
        storeOrderContext(orderId, product, seller);
      }
      status(
        "buyStatus",
        `Order created (ID: ${orderId}). Tx: ${receipt.transactionHash}`
      );
    } catch (err) {
      status("buyStatus", err.message);
    }
  });

  if (shipBtn) {
    shipBtn.addEventListener("click", async () => {
      try {
        const orderId = requireOrderId();
        if (orderId === null) {
          status("shipStatus", "Enter a valid order id");
          return;
        }
        const order = await escrow.methods.getOrder(orderId).call();
        const account = await requireMatchingAccount(order.seller, "shipStatus", "seller");
        if (!account) return;
        status("shipStatus", "Confirming shipment...");
        const receipt = await escrow.methods.confirmShipment(orderId).send({ from: account });
        status("shipStatus", `Shipment confirmed. Tx: ${receipt.transactionHash}`);
        await refreshOrderStatus(escrow, orderId);
      } catch (err) {
        status("shipStatus", err.message);
      }
    });
  }

  if (deliverBtn) {
    deliverBtn.addEventListener("click", async () => {
      try {
        const orderId = requireOrderId();
        if (orderId === null) {
          status("deliverStatus", "Enter a valid order id");
          return;
        }
        const order = await escrow.methods.getOrder(orderId).call();
        const account = await requireMatchingAccount(order.buyer, "deliverStatus", "buyer");
        if (!account) return;
        status("deliverStatus", "Confirming delivery...");
        const receipt = await escrow.methods.confirmDelivery(orderId).send({ from: account });
        status("deliverStatus", `Delivery confirmed. Tx: ${receipt.transactionHash}`);
        await refreshOrderStatus(escrow, orderId);
      } catch (err) {
        status("deliverStatus", err.message);
      }
    });
  }

  if (releaseBtn) {
    releaseBtn.addEventListener("click", async () => {
      try {
        const orderId = requireOrderId();
        if (orderId === null) {
          status("releaseStatus", "Enter a valid order id");
          return;
        }
        status("releaseStatus", "Checking order status...");
        const order = await escrow.methods.getOrder(orderId).call();
        const account = await requireMatchingAccount(order.seller, "releaseStatus", "seller");
        if (!account) return;
        const amountWei = BigInt(order.amountWei || 0);
        if (amountWei === 0n) {
          status("releaseStatus", "Order not found or already settled.");
          return;
        }
        if (!order.shipped) {
          status("releaseStatus", "Shipment must be confirmed first.");
          return;
        }
        if (!order.delivered) {
          status("releaseStatus", "Buyer must confirm delivery first.");
          return;
        }
        if (order.paidOut) {
          status("releaseStatus", "Payment already released.");
          return;
        }
        status("releaseStatus", "Releasing payment...");
        const receipt = await escrow.methods.releasePayment(orderId).send({ from: account });
        status("releaseStatus", `Payment released. Tx: ${receipt.transactionHash}`);
        await refreshOrderStatus(escrow, orderId);
      } catch (err) {
        status("releaseStatus", err.message);
      }
    });
  }

  if (rateBtn) {
    rateBtn.addEventListener("click", async () => {
      try {
        const orderId = requireOrderId();
        if (orderId === null) {
          status("rateStatus", "Enter a valid order id");
          return;
        }
        const stars = Number(document.getElementById("stars").value || 0);
        const comment = document.getElementById("comment").value || "";
        const account = await connectWallet();
        status("rateStatus", "Submitting rating...");
        const receipt = await escrow.methods
          .submitRating(orderId, stars, comment)
          .send({ from: account });
        status("rateStatus", `Rating submitted. Tx: ${receipt.transactionHash}`);
        const order = await escrow.methods.getOrder(orderId).call();
        await refreshRating(reputation, order.seller);
        await refreshOrderStatus(escrow, orderId);
      } catch (err) {
        status("rateStatus", err.message);
      }
    });
  }
}

window.addEventListener("load", () => {
  init().catch((err) => {
    status("buyStatus", err.message);
  });
});
