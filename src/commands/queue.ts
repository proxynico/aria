import type { Command } from "commander";
import type { MusicEngine } from "../lib/types";
import { getOutputMode, outputJson, outputMessage } from "../lib/output";

export function registerQueueCommands(program: Command, getEngine: () => MusicEngine) {
  const queue = program.command("queue").alias("q").description("Queue management");

  queue
    .command("add <trackId>")
    .description("Add a track to the queue by its ID")
    .action(async (trackId: string) => {
      const engine = getEngine();
      await engine.addToQueue(trackId);
      const mode = getOutputMode(program.opts());
      if (mode === "json") {
        outputJson({ action: "queue_add", trackId });
      } else if (mode !== "plain") {
        outputMessage(`Added to queue: ${trackId}`);
      }
    });
}
