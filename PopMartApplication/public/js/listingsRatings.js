/* global Web3 */

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

async function loadArtifact(name) {
  const res = await fetch(`/build/${name}.json`);
  if (!res.ok) {
    throw new Error(`Missing artifact: ${name}`);
  }
  return res.json();
}

function setNote(el, message) {
  if (el) {
    el.textContent = message;
  }
}

function renderStars(container, value) {
  if (!container) return;
  const stars = container.querySelectorAll(".star");
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

function sellerKey(productId) {
  return `popmartSellerByProduct_${productId}`;
}

function getStoredSeller(productId) {
  if (!window.localStorage || !productId) return null;
  const value = localStorage.getItem(sellerKey(productId));
  return value ? value.trim() : null;
}

function getSellerAddress(card) {
  if (!card) return null;
  const attr = (card.dataset.sellerAddress || "").trim();
  if (attr) return attr;
  const productId = card.dataset.productId;
  return getStoredSeller(productId);
}

async function getContracts(web3) {
  const repArtifact = await loadArtifact("SellerReputation");
  const networkId = await web3.eth.net.getId();

  if (Number(networkId) === 1) {
    throw new Error("Mainnet not supported");
  }

  const repInfo = repArtifact.networks[networkId];
  if (!repInfo || !repInfo.address) {
    throw new Error(`SellerReputation not deployed on network ${networkId}`);
  }

  return {
    reputation: new web3.eth.Contract(repArtifact.abi, repInfo.address),
  };
}

async function hydrateCard(reputation, card) {
  const starsEl = card.querySelector(".stars");
  const noteEl = card.querySelector(".stars-note");
  const seller = getSellerAddress(card);
  if (!seller || seller === ZERO_ADDRESS) {
    setNote(noteEl, "Rating unavailable");
    return;
  }
  try {
    const [avgTimes100, count] = await Promise.all([
      reputation.methods.getAverageRating(seller).call(),
      reputation.methods.ratingCount(seller).call(),
    ]);
    const avg = Number(avgTimes100) / 100;
    renderStars(starsEl, avg);
    const label = Number.isFinite(avg) ? avg.toFixed(2) : "0.00";
    setNote(noteEl, `${label} / 5 (${count})`);
  } catch (_) {
    setNote(noteEl, "Rating unavailable");
  }
}

async function init() {
  const cards = document.querySelectorAll(".product-card");
  if (!cards.length) return;
  if (!window.ethereum || !window.Web3) {
    return;
  }
  const web3 = new Web3(window.ethereum);
  const { reputation } = await getContracts(web3);
  await Promise.all(Array.from(cards).map((card) => hydrateCard(reputation, card)));
}

window.addEventListener("load", () => {
  init().catch(() => {});
});
