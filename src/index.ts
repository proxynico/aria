#!/usr/bin/env bun

import { Command } from "commander";
import { NativeEngine } from "./engines/native";
import { ApiEngine } from "./engines/api";
import { AutoEngine } from "./engines/auto";
import { registerPlaybackCommands } from "./commands/playback";
import { registerSearchCommands } from "./commands/search";
import { registerLibraryCommands } from "./commands/library";
import { registerAuthCommands } from "./commands/auth";
import { registerDeviceCommands } from "./commands/devices";
import { registerQueueCommands } from "./commands/queue";
import { setColorEnabled, outputError } from "./lib/output";
import type { MusicEngine } from "./lib/types";

const VERSION = "0.1.0";

const program = new Command()
  .name("aria")
  .description("Apple Music CLI for power users and AI agents")
  .version(VERSION)
  .option("--json", "Output as JSON")
  .option("--plain", "Output as tab-separated plain text")
  .option("--no-color", "Disable color output")
  .option("-e, --engine <engine>", "Engine: native, api, auto (default: auto)", "auto")
  .option("-v, --verbose", "Verbose output")
  .hook("preAction", () => {
    const opts = program.opts();
    if (opts.noColor || process.env.NO_COLOR || process.env.TERM === "dumb") {
      setColorEnabled(false);
    }
  });

function createEngine(): MusicEngine {
  const opts = program.opts();
  switch (opts.engine) {
    case "native":
      return new NativeEngine();
    case "api":
      return new ApiEngine();
    case "auto":
    default:
      return new AutoEngine();
  }
}

// Lazy engine — created on first command that needs it
let engine: MusicEngine | null = null;
function getEngine(): MusicEngine {
  if (!engine) engine = createEngine();
  return engine;
}

// Register all command groups
registerPlaybackCommands(program, getEngine);
registerSearchCommands(program, getEngine);
registerLibraryCommands(program, getEngine);
registerAuthCommands(program);
registerDeviceCommands(program, getEngine);
registerQueueCommands(program, getEngine);

// Error handling
program.exitOverride();

async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err) {
      const code = (err as { code: string }).code;
      if (code === "commander.helpDisplayed" || code === "commander.version") {
        process.exit(0);
      }
    }
    outputError((err as Error).message || String(err));
    process.exit(1);
  }
}

main();
