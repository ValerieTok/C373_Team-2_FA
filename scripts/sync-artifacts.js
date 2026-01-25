const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const sourceDir = path.join(repoRoot, "build", "contracts");
const targetDir = path.join(repoRoot, "PopMartApplication", "public", "build");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyArtifacts() {
  if (!fs.existsSync(sourceDir)) {
    console.error("Missing build/contracts. Run truffle migrate first.");
    process.exit(1);
  }
  ensureDir(targetDir);
  const files = fs.readdirSync(sourceDir).filter((file) => file.endsWith(".json"));
  files.forEach((file) => {
    const src = path.join(sourceDir, file);
    const dest = path.join(targetDir, file);
    fs.copyFileSync(src, dest);
  });
  console.log("Copied artifacts to " + targetDir);
}

copyArtifacts();
