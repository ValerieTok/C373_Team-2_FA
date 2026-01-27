const path = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const session = require("express-session");

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const DEFAULT_SELLER_WALLET = String(process.env.DEFAULT_SELLER_WALLET || "").trim();
const DEFAULT_BUYER_WALLET = String(process.env.DEFAULT_BUYER_WALLET || "").trim();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/images", express.static(path.join(__dirname, "images")));
app.use(
  session({
    secret: "popmart-market-session",
    resave: false,
    saveUninitialized: true,
  })
);

let cart = [];
let orders = [];
let ratings = [];
let nextOrderId = 1001;
let draftQuantities = {};
let listingTemplates = [];

const templatesPath = path.join(__dirname, "data", "listing-templates.json");
try {
  const rawTemplates = fs.readFileSync(templatesPath, "utf8");
  const parsed = JSON.parse(rawTemplates);
  if (Array.isArray(parsed)) {
    listingTemplates = parsed;
  }
} catch (err) {
  listingTemplates = [];
}

const uploadsDir = path.join(__dirname, "images");
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const safeName = String(file.originalname || "upload")
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9.\-_]/g, "");
    cb(null, `${Date.now()}-${safeName}`);
  },
});
const upload = multer({ storage });

const seedProducts = [
  {
    id: 1,
    name: "Solar Drift Capsule",
    category: "Limited Drop",
    sellerName: "Marketplace Seller",
    sellerWallet: DEFAULT_SELLER_WALLET,
    shortDesc: "Heat-washed resin with enamel crest.",
    fullDesc:
      "A glowing capsule figure with layered metallic ink and a numbered base card. Ships in a clear vault sleeve.",
    priceEth: 0.38,
    image: "/images/popmart1.png",
  },
  {
    id: 2,
    name: "Koi Circuit Guardian",
    category: "Artist Series",
    sellerName: "Marketplace Seller",
    sellerWallet: DEFAULT_SELLER_WALLET,
    shortDesc: "Chrome fins and etched circuit spine.",
    fullDesc:
      "Hand-finished details with micro-etching and a holographic cert. Escrow friendly for high-value trades.",
    priceEth: 0.52,
    image: "/images/popmart2.png",
  },
  {
    id: 3,
    name: "Moonlit Parade Trio",
    category: "Collector",
    sellerName: "Marketplace Seller",
    sellerWallet: DEFAULT_SELLER_WALLET,
    shortDesc: "Three-piece set with dusk gradients.",
    fullDesc:
      "A trio of parade figures with foil accents and foam-lined tray. Ships insured with tracking.",
    priceEth: 0.29,
    image: "/images/popmart3.png",
  },
];

let products = seedProducts;

function getSellerWallet(req) {
  const sessionWallet = req && req.session ? String(req.session.sellerWallet || "") : "";
  return String(sessionWallet || DEFAULT_SELLER_WALLET || "").trim();
}

function nextProductId() {
  return products.reduce((maxId, item) => Math.max(maxId, item.id), 0) + 1;
}

function findProduct(productId) {
  return products.find((item) => item.id === productId) || null;
}

function formatTimestamp(value) {
  if (!value) return "Pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Pending";
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDurationMs(durationMs, scaleSecondsToMinutes = 1) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return "Pending";
  const scaledMinutes = Math.round((durationMs / 1000) * scaleSecondsToMinutes);
  if (scaledMinutes < 60) {
    return `${scaledMinutes} min`;
  }
  const hours = Math.floor(scaledMinutes / 60);
  const minutes = scaledMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

function buildRatingsSummary(items, allRatings) {
  const summary = {};
  items.forEach((product) => {
    const list = allRatings.filter((rating) => rating.productId === product.id);
    const count = list.length;
    const avg =
      count === 0
        ? 0
        : list.reduce((sum, rating) => sum + Number(rating.stars || 0), 0) / count;
    summary[product.id] = { avg, count };
  });
  return summary;
}

function buildAvgShipTimeByProduct(items, allOrders) {
  const summary = {};
  items.forEach((product) => {
    const durations = allOrders
      .filter((order) => order.productId === product.id && order.createdAt && order.shippedAt)
      .map((order) => {
        const created = new Date(order.createdAt).getTime();
        const shipped = new Date(order.shippedAt).getTime();
        if (Number.isNaN(created) || Number.isNaN(shipped)) return null;
        const diff = shipped - created;
        return diff >= 0 ? diff : null;
      })
      .filter((diff) => diff !== null);
    const avgMs =
      durations.length > 0
        ? durations.reduce((sum, diff) => sum + diff, 0) / durations.length
        : null;
    summary[product.id] = {
      avgMs,
      avgDisplay: formatDurationMs(avgMs, 10),
      count: durations.length,
    };
  });
  return summary;
}

app.use((req, res, next) => {
  res.locals.cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  next();
});

app.get("/", (req, res) => {
  const quantities = {};
  products.forEach((product) => {
    quantities[product.id] = draftQuantities[product.id] || 1;
  });
  const ratingsSummary = buildRatingsSummary(products, ratings);
  const shipTimeSummary = buildAvgShipTimeByProduct(products, orders);
  let bestProductId = null;
  let bestScore = -1;
  products.forEach((product) => {
    const info = ratingsSummary[product.id];
    if (!info || info.count === 0) return;
    if (info.avg > bestScore) {
      bestScore = info.avg;
      bestProductId = product.id;
    }
  });
  res.render("index", {
    products,
    quantities,
    ratingsSummary,
    shipTimeSummary,
    bestProductId,
  });
});

app.get("/seller", (req, res) => {
  const sellerWallet = getSellerWallet(req);
  const sellerWalletKey = sellerWallet ? sellerWallet.toLowerCase() : "";
  const userListings = products.filter((product) => product.isUserListing);
  const hasUserListings = userListings.length > 0;
  const sellerAccess =
    !hasUserListings ||
    userListings.some(
      (product) =>
        product.sellerWallet &&
        product.sellerWallet.toLowerCase() === sellerWalletKey
    );
  const filteredProducts = sellerWalletKey
    ? products.filter(
        (product) =>
          product.sellerWallet &&
          product.sellerWallet.toLowerCase() === sellerWalletKey
      )
    : [];
  const filteredOrders = sellerWalletKey
    ? orders.filter(
        (order) =>
          order.sellerWallet &&
          order.sellerWallet.toLowerCase() === sellerWalletKey
      )
    : [];
  const formattedOrders = orders.map((order) => ({
    ...order,
    createdAtDisplay: formatTimestamp(order.createdAt),
    shippedAtDisplay: formatTimestamp(order.shippedAt),
    deliveredAtDisplay: formatTimestamp(order.deliveredAt),
    releasedAtDisplay: formatTimestamp(order.releasedAt),
  }));
  const filteredFormattedOrders = formattedOrders.filter(
    (order) =>
      sellerWalletKey &&
      order.sellerWallet &&
      order.sellerWallet.toLowerCase() === sellerWalletKey
  );
  const earningsEth = filteredFormattedOrders
    .filter((order) => order.paymentReleased)
    .reduce((sum, order) => sum + order.priceEth * order.qty, 0);
  res.render("seller", {
    products: sellerAccess ? filteredProducts : [],
    orders: sellerAccess ? filteredFormattedOrders : [],
    earningsEth: sellerAccess ? earningsEth : 0,
    defaultSellerWallet: sellerWallet,
    listingTemplate: listingTemplates[0] || null,
    sellerAccess,
  });
});

app.post("/seller/wallet", (req, res) => {
  const wallet = String(req.body.sellerWallet || "").trim();
  if (req.session) {
    req.session.sellerWallet = wallet;
  }
  res.json({ ok: true });
});

app.post("/seller/listings", upload.single("imageFile"), (req, res) => {
  const {
    name,
    category,
    shortDesc,
    priceEth,
    sellerWallet,
    image,
  } = req.body;
  const sellerWalletAddress = String(sellerWallet || getSellerWallet(req) || "").trim();
  if (!sellerWalletAddress) {
    return res.status(400).send("Seller wallet missing. Connect MetaMask and try again.");
  }

  const imagePath = req.file
    ? `/images/${req.file.filename}`
    : String(image || "/images/popmart1.png").trim();
  const product = {
    id: nextProductId(),
    name: String(name || "Untitled Listing").trim(),
    category: String(category || "General").trim(),
    sellerName: "Marketplace Seller",
    sellerWallet: sellerWalletAddress,
    shortDesc: String(shortDesc || "New listing").trim(),
    fullDesc: String(shortDesc || "New listing").trim(),
    priceEth: Number(priceEth || 0),
    image: imagePath,
    isUserListing: true,
  };

  products = [product, ...products];
  draftQuantities[product.id] = 1;
  res.redirect("/");
});

app.post("/listings/:id/qty/increase", (req, res) => {
  const productId = Number(req.params.id);
  const current = draftQuantities[productId] || 1;
  draftQuantities[productId] = current + 1;
  res.redirect("/");
});

app.post("/listings/:id/qty/decrease", (req, res) => {
  const productId = Number(req.params.id);
  const current = draftQuantities[productId] || 1;
  draftQuantities[productId] = Math.max(current - 1, 1);
  res.redirect("/");
});

app.post("/seller/orders/:id/ship", (req, res) => {
  const orderId = Number(req.params.id);
  const order = orders.find((item) => item.id === orderId);
  const sessionWallet = getSellerWallet(req).toLowerCase();
  const orderWallet = order && order.sellerWallet ? order.sellerWallet.toLowerCase() : "";
  if (!order || !orderWallet || !sessionWallet || orderWallet !== sessionWallet) {
    if (req.is("application/json")) {
      return res.status(403).json({ ok: false, message: "Seller wallet mismatch." });
    }
    return res.status(403).send("Seller wallet mismatch.");
  }
  orders = orders.map((order) =>
    order.id === orderId && order.status === "Awaiting Shipment"
      ? { ...order, status: "Shipped", shippedAt: new Date().toISOString() }
      : order
  );
  if (req.is("application/json")) {
    return res.json({ ok: true });
  }
  res.redirect("/seller");
});

app.get("/buyer", (req, res) => {
  res.render("buyer", { orders });
});

app.get("/cart", (req, res) => {
  const added = Boolean(req.session && req.session.cartAdded);
  if (req.session) {
    req.session.cartAdded = false;
  }
  res.render("cart", { cart, added });
});

app.post("/cart/add", (req, res) => {
  const productId = Number(req.body.productId);
  const qty = Math.max(Number(req.body.qty || 1), 1);
  const product = findProduct(productId);
  const buyerWallet = String(req.body.buyerWallet || DEFAULT_BUYER_WALLET || "").trim();
  const sellerWallet = product ? String(product.sellerWallet || "").trim() : "";
  if (buyerWallet && sellerWallet && buyerWallet.toLowerCase() === sellerWallet.toLowerCase()) {
    return res.status(400).send("Sellers cannot buy their own products.");
  }
  const existing = cart.find((item) => item.productId === productId);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({
      productId,
      name: String(req.body.name || "Item").trim(),
      category: String(req.body.category || "General").trim(),
      priceEth: Number(req.body.priceEth || 0),
      sellerName: product ? product.sellerName : "Marketplace Seller",
      sellerWallet: product ? product.sellerWallet : "",
      image: String(req.body.image || "/images/popmart1.png").trim(),
      qty,
    });
  }
  if (req.session) {
    req.session.cartAdded = true;
  }
  res.redirect("/cart");
});

app.post("/cart/remove", (req, res) => {
  const productId = Number(req.body.productId);
  cart = cart.filter((item) => item.productId !== productId);
  res.redirect("/cart");
});

app.get("/checkout", (req, res) => {
  res.render("checkout", { cart, status: null });
});

app.post("/checkout", (req, res) => {
  const isJson = req.is("application/json");
  const chainOrders = Array.isArray(req.body.chainOrders) ? req.body.chainOrders : [];
  const buyerWallet = String(req.body.buyerWallet || DEFAULT_BUYER_WALLET || "").trim();
  if (!cart.length) {
    if (isJson) {
      return res.status(400).json({ ok: false, message: "Your cart is empty." });
    }
    return res.render("checkout", { cart, status: "Your cart is empty." });
  }
  const buyerName = String(req.body.buyerName || "").trim();
  const buyerEmail = String(req.body.buyerEmail || "").trim();
  const buyerPhone = String(req.body.buyerPhone || "").trim();
  const buyerAddress = String(req.body.buyerAddress || "").trim();
  const createdAt = new Date().toISOString();
  const lowerBuyerWallet = buyerWallet ? buyerWallet.toLowerCase() : "";

  if (lowerBuyerWallet) {
    const ownProduct = cart.find(
      (item) =>
        item.sellerWallet &&
        String(item.sellerWallet).toLowerCase() === lowerBuyerWallet
    );
    if (ownProduct) {
      const message = "Sellers cannot buy their own products.";
      if (isJson) {
        return res.status(400).json({ ok: false, message });
      }
      return res.render("checkout", { cart, status: message });
    }
  }

  const newOrders = cart.map((item, index) => {
    const chainOrder = chainOrders[index] || {};
    return {
      id: nextOrderId++,
      productId: item.productId,
      productName: item.name,
      category: item.category,
      priceEth: item.priceEth,
      image: item.image,
      qty: item.qty,
      status: "Awaiting Shipment",
      buyerName,
      buyerEmail,
      buyerPhone,
      buyerAddress,
      buyerWallet,
      sellerWallet: item.sellerWallet || "",
      escrowOrderId: chainOrder.orderId || null,
      escrowTxHash: chainOrder.txHash || null,
      createdAt,
      rated: false,
      reviewOpen: false,
      reviewSkipped: false,
      paymentReleased: false,
      releasedAt: null,
      sellerName: item.sellerName || "Marketplace Seller",
    };
  });
  orders = orders.concat(newOrders);
  cart = [];
  if (isJson) {
    return res.json({ ok: true, redirect: "/buyer" });
  }
  res.render("checkout", { cart, status: "Order placed! Seller will confirm shipment soon." });
});

app.get("/product/:id", (req, res) => {
  const productId = Number(req.params.id);
  const product = products.find((item) => item.id === productId);
  if (!product) {
    return res.status(404).send("Product not found");
  }
  const productRatings = ratings
    .filter((rating) => rating.productId === productId)
    .map((rating) => ({ ...rating, createdAtDisplay: formatTimestamp(rating.createdAt) }));
  return res.render("product", { product, ratings: productRatings });
});

app.get("/ratings/:id", (req, res) => {
  const productId = Number(req.params.id);
  const product = products.find((item) => item.id === productId);
  if (!product) {
    return res.status(404).send("Product not found");
  }
  const productRatings = ratings
    .filter((rating) => rating.productId === productId)
    .map((rating) => ({ ...rating, createdAtDisplay: formatTimestamp(rating.createdAt) }));
  return res.render("ratings", { product, ratings: productRatings });
});

app.post("/buyer/orders/:id/deliver", (req, res) => {
  const orderId = Number(req.params.id);
  orders = orders.map((order) =>
    order.id === orderId && order.status === "Shipped"
      ? {
          ...order,
          status: "Delivered",
          deliveredAt: new Date().toISOString(),
          paymentReleased: true,
          releasedAt: new Date().toISOString(),
        }
      : order
  );
  if (req.is("application/json")) {
    return res.json({ ok: true });
  }
  res.redirect("/buyer");
});

app.post("/buyer/orders/:id/rate", (req, res) => {
  const orderId = Number(req.params.id);
  const order = orders.find((item) => item.id === orderId);
  if (!order || order.status !== "Delivered" || order.rated) {
    if (req.is("application/json")) {
      return res.status(400).json({ ok: false, message: "Invalid order state." });
    }
    return res.redirect("/buyer");
  }
  const stars = Math.min(Math.max(Number(req.body.stars || 5), 1), 5);
  const comment = String(req.body.comment || "").trim();
  ratings.push({
    productId: order.productId,
    productName: order.productName,
    buyerName: order.buyerName || "Buyer",
    orderId: order.id,
    stars,
    comment,
    createdAt: new Date().toISOString(),
  });
  orders = orders.map((item) =>
    item.id === orderId ? { ...item, rated: true, reviewOpen: false } : item
  );
  if (req.is("application/json")) {
    return res.json({ ok: true });
  }
  res.redirect("/buyer");
});

app.post("/buyer/orders/:id/review/start", (req, res) => {
  const orderId = Number(req.params.id);
  orders = orders.map((order) =>
    order.id === orderId && order.status === "Delivered" && !order.rated
      ? { ...order, reviewOpen: true, reviewSkipped: false }
      : order
  );
  res.redirect("/buyer");
});

app.post("/buyer/orders/:id/review/skip", (req, res) => {
  const orderId = Number(req.params.id);
  orders = orders.map((order) =>
    order.id === orderId && order.status === "Delivered" && !order.rated
      ? { ...order, reviewOpen: false, reviewSkipped: true }
      : order
  );
  res.redirect("/buyer");
});

app.listen(PORT, () => {
  console.log(`Marketplace UI running on http://localhost:${PORT}`);
});
