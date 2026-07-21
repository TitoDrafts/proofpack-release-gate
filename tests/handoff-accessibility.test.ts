import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HandoffPanel } from "../app/components/HandoffPanel.tsx";
import { compileProofPack } from "../src/proofpack/index.ts";
import { loadProjectAlder } from "./proofpack-fixtures.ts";

test("artifact export controls have distinct accessible names and concise visible text", async () => {
  const pack = await compileProofPack(await loadProjectAlder());
  const html = renderToStaticMarkup(createElement(HandoffPanel, {
    pack,
    diff: null,
    isCompiling: false,
    humanDecision: null,
    onRecordDecision: () => undefined,
    onCopy: () => undefined,
    onDownload: () => undefined,
  }));

  assert.match(html, /aria-label="Copy Operator handoff Markdown"/);
  assert.match(html, /aria-label="Download Operator handoff Markdown"/);
  assert.match(html, /aria-label="Copy Allowlisted shareable export Markdown"/);
  assert.match(html, /aria-label="Download Allowlisted shareable export Markdown"/);
  assert.equal(html.match(/>Copy Markdown<\/button>/g)?.length, 2);
  assert.equal(html.match(/>Download \.md<\/button>/g)?.length, 2);
});
