import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);
const appSources = [
  "app/page.tsx",
  "app/layout.tsx",
  "app/globals.css",
  "app/ProofPackApp.tsx",
  "app/components/SourcePanel.tsx",
  "app/components/LedgerPanel.tsx",
  "app/components/HandoffPanel.tsx",
  "app/release-gate-model.ts",
  "src/proofpack/demo-bundle.ts",
];
const textAssetExtensions = new Set([".css", ".html", ".js", ".json", ".map", ".svg"]);
const forbiddenProductText =
  /Your site is taking shape|Starter Project|codex-preview|react-loading-skeleton|_sites-preview/i;
const forbiddenDomains = [
  "api.openai.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "google-analytics.com",
  "googletagmanager.com",
  "plausible.io",
  "segment.com",
  "cdn.jsdelivr.net",
  "unpkg.com",
];
const remoteImageReference =
  /(?:<img\b[^>]*\bsrc\s*=\s*["']?\s*(?:https?:)?\/\/|(?:url|image-set)\(\s*["']?\s*(?:https?:)?\/\/)/i;

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

async function collectBuiltText(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const chunks = [];
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      chunks.push(await collectBuiltText(file));
    } else if (textAssetExtensions.has(path.extname(entry.name))) {
      chunks.push(await readFile(file, "utf8"));
    }
  }
  return chunks.flat().join("\n");
}

test("server-renders the complete ProofPack product frame before client compilation", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>ProofPack Release Gate<\/title>/i);
  assert.match(html, /<main\b/i);
  assert.match(html, /ProofPack Release Gate/);
  assert.match(html, /No source, no claim\. No evidence, no release\./);
  assert.match(html, /<h2[^>]*>\s*Release packet\s*<\/h2>/i);
  assert.match(html, /<h2[^>]*>\s*Evidence ledger\s*<\/h2>/i);
  assert.match(html, /<h2[^>]*>\s*Fabrication handoff\s*<\/h2>/i);
  assert.match(html, /role=["']status["']/i);
  assert.doesNotMatch(html, forbiddenProductText);
});

test("publishes canonical social metadata for the verified production release", async () => {
  const response = await render();
  const html = await response.text();
  const productionUrl = "https://proofpack-release-gate.tito943366.chatgpt.site/";
  const socialImageUrl = `${productionUrl}og.png`;

  assert.match(html, new RegExp(`<link[^>]+rel=["']canonical["'][^>]+href=["']${productionUrl}["']`, "i"));
  assert.match(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']ProofPack Release Gate["']/i);
  assert.match(html, new RegExp(`<meta[^>]+property=["']og:image["'][^>]+content=["']${socialImageUrl}["']`, "i"));
  assert.match(html, /<meta[^>]+name=["']twitter:card["'][^>]+content=["']summary_large_image["']/i);

  const png = await readFile(new URL("../public/og.png", import.meta.url));
  assert.equal(png.subarray(1, 4).toString("ascii"), "PNG");
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
});

test("ships no starter package, remote service, font, analytics, or image asset", async () => {
  const sources = await Promise.all(
    appSources.map((sourcePath) => readFile(new URL(`../${sourcePath}`, import.meta.url), "utf8")),
  );
  const response = await render();
  const builtText = await collectBuiltText(fileURLToPath(new URL("../dist/client/", import.meta.url)));
  const renderedSourceAndAssets = `${await response.text()}\n${sources.join("\n")}\n${builtText}`;

  assert.doesNotMatch(renderedSourceAndAssets, forbiddenProductText);
  assert.doesNotMatch(sources.join("\n"), /\bfetch\s*\(|["']use server["']|\/api\//i);
  for (const domain of forbiddenDomains) {
    assert.doesNotMatch(renderedSourceAndAssets, new RegExp(domain.replaceAll(".", "\\."), "i"));
  }
  assert.doesNotMatch(renderedSourceAndAssets, remoteImageReference);

  const packageJson = await readFile(new URL("../package.json", import.meta.url), "utf8");
  assert.doesNotMatch(packageJson, /react-loading-skeleton|@fontsource|next\/font/i);
  await Promise.all([
    assert.rejects(access(new URL("app/_sites-preview/SkeletonPreview.tsx", templateRoot))),
    assert.rejects(access(new URL("app/_sites-preview/preview.css", templateRoot))),
  ]);
});
