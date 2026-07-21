import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;
const templateRoot = new URL("../", import.meta.url);
const appSources = ["app/page.tsx", "app/layout.tsx", "app/globals.css"];
const absoluteOrProtocolRelativeUrl = /(?:https?:)?\/\/[^\s"'<>]+/i;

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

test("server-renders the current minimal development shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, developmentPreviewMeta);
  assert.match(html, /<title>Your site is taking shape<\/title>/i);
  assert.match(html, /<body\b/i);
  assert.doesNotMatch(html, /<main\b|<section\b|<article\b|role=["']status["']/i);
  assert.doesNotMatch(
    html,
    /Building your site|react-loading-skeleton/i,
  );
});

test("contains no disposable starter assets or remote asset references", async () => {
  const sources = await Promise.all(
    appSources.map((path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")),
  );
  const response = await render();
  const renderedHtmlAndSource = `${await response.text()}\n${sources.join("\n")}`;

  assert.doesNotMatch(renderedHtmlAndSource, absoluteOrProtocolRelativeUrl);
  assert.doesNotMatch(renderedHtmlAndSource, /react-loading-skeleton|_sites-preview/i);

  const packageJson = await readFile(new URL("../package.json", import.meta.url), "utf8");
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await Promise.all([
    assert.rejects(access(new URL("app/_sites-preview/SkeletonPreview.tsx", templateRoot))),
    assert.rejects(access(new URL("app/_sites-preview/preview.css", templateRoot))),
  ]);
});
