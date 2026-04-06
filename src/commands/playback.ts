import type { Command } from "commander";
import type { MusicEngine } from "../lib/types";
import { ValidationError } from "../lib/errors";
import { parseInteger } from "../lib/input";
import { getOutputMode, outputStatus, outputMessage, outputJson } from "../lib/output";

export function registerPlaybackCommands(program: Command, getEngine: () => MusicEngine) {
  program
    .command("play [query]")
    .description("Play a track, or resume playback")
    .action(async (query?: string) => {
      const engine = getEngine();
      await engine.play(query);
      const mode = getOutputMode(program.opts());
      if (mode === "json") {
        outputJson({ action: "play", query: query || null });
      } else if (mode !== "plain") {
        outputMessage(query ? `Playing: ${query}` : "Resumed playback");
      }
    });

  program
    .command("pause")
    .description("Pause playback")
    .action(async () => {
      const engine = getEngine();
      await engine.pause();
      const mode = getOutputMode(program.opts());
      if (mode === "json") {
        outputJson({ action: "pause" });
      } else if (mode !== "plain") {
        outputMessage("Paused");
      }
    });

  program
    .command("resume")
    .description("Resume playback")
    .action(async () => {
      const engine = getEngine();
      await engine.resume();
      const mode = getOutputMode(program.opts());
      if (mode === "json") {
        outputJson({ action: "resume" });
      } else if (mode !== "plain") {
        outputMessage("Resumed");
      }
    });

  program
    .command("next")
    .description("Skip to next track")
    .action(async () => {
      const engine = getEngine();
      await engine.next();
      const mode = getOutputMode(program.opts());
      if (mode === "json") {
        outputJson({ action: "next" });
      } else if (mode !== "plain") {
        outputMessage("Skipped to next track");
      }
    });

  program
    .command("prev")
    .description("Go to previous track")
    .action(async () => {
      const engine = getEngine();
      await engine.previous();
      const mode = getOutputMode(program.opts());
      if (mode === "json") {
        outputJson({ action: "previous" });
      } else if (mode !== "plain") {
        outputMessage("Previous track");
      }
    });

  program
    .command("seek <seconds>")
    .description("Seek to position in seconds")
    .action(async (seconds: string) => {
      const engine = getEngine();
      const secs = parseInteger("seek position", seconds, { min: 0 });
      await engine.seek(secs);
      const mode = getOutputMode(program.opts());
      if (mode === "json") {
        outputJson({ action: "seek", position: secs });
      } else if (mode !== "plain") {
        outputMessage(`Seeked to ${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, "0")}`);
      }
    });

  program
    .command("status")
    .description("Show current playback status")
    .action(async () => {
      const engine = getEngine();
      const status = await engine.getStatus();
      const mode = getOutputMode(program.opts());
      outputStatus(status, mode);
    });

  program
    .command("volume [level]")
    .description("Get or set volume (0-100)")
    .action(async (level?: string) => {
      const engine = getEngine();
      const mode = getOutputMode(program.opts());

      if (level === undefined) {
        const vol = await engine.getVolume();
        if (mode === "json") {
          outputJson({ volume: vol });
        } else if (mode === "plain") {
          console.log(vol);
        } else {
          console.log(`Volume: ${vol}`);
        }
      } else {
        const vol = parseInteger("volume", level, { min: 0, max: 100 });
        await engine.setVolume(vol);
        if (mode === "json") {
          outputJson({ action: "volume", volume: vol });
        } else if (mode !== "plain") {
          outputMessage(`Volume set to ${vol}`);
        }
      }
    });

  program
    .command("shuffle [on|off]")
    .description("Toggle or set shuffle mode")
    .action(async (value?: string) => {
      const engine = getEngine();
      const mode = getOutputMode(program.opts());
      const current = await engine.getShuffle();
      if (value === "on" || value === "off") {
        const enabled = value === "on";
        await engine.setShuffle(enabled);
        if (mode === "json") {
          outputJson({ shuffle: enabled });
        } else if (mode !== "plain") {
          outputMessage(`Shuffle ${enabled ? "on" : "off"}`);
        }
        return;
      }

      const newState = !current;
      await engine.setShuffle(newState);
      if (mode === "json") {
        outputJson({ shuffle: newState });
      } else if (mode !== "plain") {
        outputMessage(`Shuffle ${newState ? "on" : "off"}`);
      }
    });

  program
    .command("repeat [off|one|all]")
    .description("Set repeat mode")
    .action(async (value?: string) => {
      const engine = getEngine();
      const mode = getOutputMode(program.opts());
      const repeatValues = new Set(["off", "one", "all"]);

      if (value) {
        if (!repeatValues.has(value)) {
          throw new ValidationError("repeat mode must be one of: off, one, all");
        }
        await engine.setRepeat(value as "off" | "one" | "all");
        if (mode === "json") {
          outputJson({ repeat: value });
        } else if (mode !== "plain") {
          outputMessage(`Repeat: ${value}`);
        }
        return;
      }

      const repeatMode = await engine.getRepeat();
      if (mode === "json") {
        outputJson({ repeat: repeatMode });
      } else if (mode === "plain") {
        console.log(repeatMode);
      } else {
        console.log(`Repeat: ${repeatMode}`);
      }
    });
}
