import type { Command } from "commander";
import { loadConfig, setDefaultEngine, setStorefront } from "../lib/config";
import { ValidationError } from "../lib/errors";
import { getOutputMode, outputJson, outputKeyValue, outputMessage } from "../lib/output";
import type { AriaConfig } from "../lib/types";

const ENGINES: AriaConfig["defaultEngine"][] = ["native", "api", "auto"];

export function registerConfigCommands(program: Command) {
  const config = program.command("config").description("Manage runtime defaults");

  config
    .command("status")
    .description("Show current defaults")
    .action(async () => {
      const current = await loadConfig();
      const mode = getOutputMode(program.opts());
      if (mode === "json") {
        outputJson(current);
      } else if (mode === "plain") {
        console.log(`default_engine\t${current.defaultEngine}`);
        console.log(`storefront\t${current.storefront ?? "auto"}`);
      } else {
        outputKeyValue("Default engine", current.defaultEngine);
        outputKeyValue("Storefront", current.storefront ?? "auto");
      }
    });

  config
    .command("engine [engine]")
    .description("Get or set the default engine")
    .action(async (engine?: string) => {
      const mode = getOutputMode(program.opts());
      if (!engine) {
        const current = await loadConfig();
        if (mode === "json") {
          outputJson({ defaultEngine: current.defaultEngine });
        } else {
          console.log(current.defaultEngine);
        }
        return;
      }

      if (!ENGINES.includes(engine as AriaConfig["defaultEngine"])) {
        throw new ValidationError(`engine must be one of: ${ENGINES.join(", ")}`);
      }

      await setDefaultEngine(engine as AriaConfig["defaultEngine"]);
      if (mode === "json") {
        outputJson({ defaultEngine: engine });
      } else {
        outputMessage(`Default engine set to ${engine}`);
      }
    });

  config
    .command("storefront [storefront]")
    .description("Get or set the Apple Music storefront (or use 'auto')")
    .action(async (storefront?: string) => {
      const mode = getOutputMode(program.opts());
      if (!storefront) {
        const current = await loadConfig();
        if (mode === "json") {
          outputJson({ storefront: current.storefront ?? "auto" });
        } else {
          console.log(current.storefront ?? "auto");
        }
        return;
      }

      const normalized = storefront.toLowerCase();
      await setStorefront(normalized);
      if (mode === "json") {
        outputJson({ storefront: normalized });
      } else {
        outputMessage(`Storefront set to ${normalized}`);
      }
    });
}
