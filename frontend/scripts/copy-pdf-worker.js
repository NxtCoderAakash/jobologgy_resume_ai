/**
 * Copy pdf.js's worker into public/ so it is served statically and webpack
 * never tries to parse it (Next 14's SWC chokes on the minified v5 build).
 * Runs automatically via the predev / prebuild npm hooks.
 */
const fs = require("node:fs");
const path = require("node:path");

const src = path.join(
  __dirname,
  "..",
  "node_modules",
  "pdfjs-dist",
  "legacy",
  "build",
  "pdf.worker.min.mjs",
);
const dest = path.join(__dirname, "..", "public", "pdf.worker.min.mjs");

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log("Copied pdf.js worker ->", path.relative(process.cwd(), dest));
