import fieldCheckText from "../../fixtures/project-alder/field-check.json?raw";
import finishScheduleText from "../../fixtures/project-alder/finish-schedule.md?raw";
import handoffDraftText from "../../fixtures/project-alder/handoff-draft.md?raw";
import incomingReceiptsText from "../../fixtures/project-alder/incoming-receipts.log?raw";
import packetText from "../../fixtures/project-alder/packet.json?raw";
import rfi042Text from "../../fixtures/project-alder/rfi-042.json?raw";
import rulesText from "../../fixtures/project-alder/release-rules.json?raw";
import sampleRegisterText from "../../fixtures/project-alder/sample-register.json?raw";
import shopNotesText from "../../fixtures/project-alder/shop-notes.log?raw";
import type {
  CompileInput,
  PacketManifest,
  RuleSet,
  SourceDocument,
} from "./types.ts";

const RAW_SOURCE_BY_FILE = new Map<string, string>([
  ["handoff-draft.md", handoffDraftText],
  ["finish-schedule.md", finishScheduleText],
  ["rfi-042.json", rfi042Text],
  ["shop-notes.log", shopNotesText],
  ["field-check.json", fieldCheckText],
  ["sample-register.json", sampleRegisterText],
  ["incoming-receipts.log", incomingReceiptsText],
]);

function hydrateSources(manifest: PacketManifest): SourceDocument[] {
  return manifest.sources.map((declaration) => {
    const content = RAW_SOURCE_BY_FILE.get(declaration.file);
    if (content === undefined) {
      throw new Error(`DEMO_SOURCE_NOT_BUNDLED: ${declaration.file}`);
    }
    return { ...declaration, content };
  });
}

export function createDemoInput(): CompileInput {
  const manifest = JSON.parse(packetText) as PacketManifest;
  const rules = JSON.parse(rulesText) as RuleSet;
  return {
    manifest,
    rules,
    sources: hydrateSources(manifest),
  };
}
