const path = require("path");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/images", express.static(path.join(__dirname, "images")));

const products = [
  {
    id: 1,
    name: "Aurora Bloom Figurine",
    category: "Limited Drop",
    sellerName: "LumenVault",
    sellerWallet: "0x123afafd49f9fa15fa24ab71c1deb1c72aeb1be5",
    shortDesc: "Iridescent finish, numbered 1-500.",
    fullDesc:
      "A glow-layer figurine with etched base and serialized certificate. Ships in a protective case.",
    priceEth: 0.42,
    image: "/images/popmart1.png",
  },
  {
    id: 2,
    name: "Neo Koi Limited",
    category: "Artist Series",
    sellerName: "HarborByte",
    sellerWallet: "0x123afafd49f9fa15fa24ab71c1deb1c72aeb1be5",
    shortDesc: "Metallic koi with hand-painted details.",
    fullDesc:
      "Limited run of 250. Includes tracking hash in escrow once shipped.",
    priceEth: 0.36,
    image: "/images/popmart2.png",
  },
  {
    id: 3,
    name: "Orbit Ghost Mech",
    category: "New Drop",
    sellerName: "RetroCove",
    sellerWallet: "0x123afafd49f9fa15fa24ab71c1deb1c72aeb1be5",
    shortDesc: "Transparent mech armor with neon core.",
    fullDesc:
      "Buyer inspection window enabled. Includes QR to verify authenticity.",
    priceEth: 0.58,
    image: "/images/popmart3.png",
  },
  {
    id: 4,
    name: "Sunlit Parade Set",
    category: "Collector",
    sellerName: "PrismYard",
    sellerWallet: "0x123afafd49f9fa15fa24ab71c1deb1c72aeb1be5",
    shortDesc: "Four-piece parade set with gold accents.",
    fullDesc:
      "Escrow ready to release after delivery confirmation. Stored in foam case.",
    priceEth: 0.31,
    image: "/images/popmart4.png",
  },
  {
    id: 5,
    name: "Gilded Astro Rabbit",
    category: "Ultra Rare",
    sellerName: "NovaStack",
    sellerWallet: "0x123afafd49f9fa15fa24ab71c1deb1c72aeb1be5",
    shortDesc: "Gold leaf trim, cosmic helmet edition.",
    fullDesc:
      "Premium collectible with escrow dispute option enabled for high value.",
    priceEth: 0.71,
    image: "/images/popmart5.png",
  },
];

const sampleOrders = [
  { orderId: 101, productName: "Aurora Bloom Figurine", status: "Awaiting Delivery" },
  { orderId: 102, productName: "Neo Koi Limited", status: "Shipped" },
  { orderId: 103, productName: "Orbit Ghost Mech", status: "Delivered" },
];

app.get("/", (req, res) => {
  res.render("index", { products });
});

app.get("/about", (req, res) => {
  res.render("about");
});

app.get("/myOrders", (req, res) => {
  res.render("myOrders", { sampleOrders });
});

app.get("/product/:id", (req, res) => {
  const productId = Number(req.params.id);
  const product = products.find((item) => item.id === productId);
  if (!product) {
    return res.status(404).send("Product not found");
  }
  return res.render("product", { product });
});

app.listen(PORT, () => {
  console.log(`PopMart app listening on http://localhost:${PORT}`);
});
