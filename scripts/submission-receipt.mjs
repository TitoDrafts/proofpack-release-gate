import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const markerPattern = /<!-- proofpack-receipt:start -->[\s\S]*?<!-- proofpack-receipt:end -->/gu;
const normalizedMarker = "<!-- proofpack-receipt:start -->\nSELF_REFERENCE_NORMALIZED\n<!-- proofpack-receipt:end -->";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function trackedPaths() {
  return execFileSync("git", ["ls-tree", "-r", "--name-only", "-z", "HEAD"], { encoding: "utf8" })
    .split("\0")
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, "en"));
}

const manifest = [];
for (const path of trackedPaths()) {
  const bytes = execFileSync("git", ["show", `HEAD:${path}`], { maxBuffer: 64 * 1024 * 1024 });
  const normalized = path === "README.md" || path === "docs/SUBMISSION_RECEIPT.md"
    ? Buffer.from(bytes.toString("utf8").replace(markerPattern, normalizedMarker), "utf8")
    : bytes;
  manifest.push(`${Buffer.byteLength(path, "utf8")}:${path}:${normalized.byteLength}:${sha256(normalized)}`);
}

const manifestText = `${manifest.join("\n")}\n`;
process.stdout.write([
  "ProofPack canonical repository receipt",
  `Tracked paths: ${manifest.length}`,
  `SHA-256: ${sha256(manifestText)}`,
  "Scope: sorted bytes from the committed HEAD tree; receipt marker bodies normalized to a fixed token",
  "Not a signature, trusted timestamp, or authorship proof",
  "",
].join("\n"));
