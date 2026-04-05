import type { Command } from "commander";
import { importCookiesFromBrowser, SUPPORTED_BROWSERS } from "../lib/cookies";
import { loadConfig, setMediaUserToken, saveConfig } from "../lib/config";
import { getOutputMode, outputJson, outputMessage, outputError } from "../lib/output";

export function registerAuthCommands(program: Command) {
  const auth = program.command("auth").description("Manage authentication");

  auth
    .command("import")
    .description("Import media-user-token from a browser")
    .option("-b, --browser <browser>", `Browser to import from (${SUPPORTED_BROWSERS.join(", ")})`, "safari")
    .action(async (opts) => {
      const browser = opts.browser.toLowerCase();
      if (!SUPPORTED_BROWSERS.includes(browser)) {
        outputError(`Unsupported browser: ${browser}. Use one of: ${SUPPORTED_BROWSERS.join(", ")}`);
        process.exit(2);
      }

      try {
        const token = await importCookiesFromBrowser(browser);
        const mode = getOutputMode(program.opts());
        if (mode === "json") {
          outputJson({ success: true, browser, tokenPreview: token.slice(0, 20) + "..." });
        } else {
          outputMessage(`Imported media-user-token from ${browser} (${token.length} chars)`);
        }
      } catch (err) {
        outputError((err as Error).message);
        process.exit(1);
      }
    });

  auth
    .command("token <token>")
    .description("Manually set the media-user-token")
    .action(async (token: string) => {
      await setMediaUserToken(token);
      const mode = getOutputMode(program.opts());
      if (mode === "json") {
        outputJson({ success: true, tokenPreview: token.slice(0, 20) + "..." });
      } else {
        outputMessage(`Token saved (${token.length} chars)`);
      }
    });

  auth
    .command("status")
    .description("Check authentication status")
    .action(async () => {
      const config = await loadConfig();
      const mode = getOutputMode(program.opts());
      const hasToken = !!config.mediaUserToken;

      if (mode === "json") {
        outputJson({
          authenticated: hasToken,
          engine: config.defaultEngine,
          tokenPreview: hasToken ? config.mediaUserToken!.slice(0, 20) + "..." : null,
        });
      } else if (mode === "plain") {
        console.log(`authenticated\t${hasToken}\t${config.defaultEngine}`);
      } else {
        if (hasToken) {
          outputMessage(`Authenticated (token: ${config.mediaUserToken!.slice(0, 20)}...)`);
          console.log(`Default engine: ${config.defaultEngine}`);
        } else {
          console.log("Not authenticated (API engine unavailable)");
          console.log("Native engine works without authentication.");
          console.log(`\nTo enable API: aria auth import --browser safari`);
        }
      }
    });

  auth
    .command("clear")
    .description("Remove stored credentials")
    .action(async () => {
      const config = await loadConfig();
      delete config.mediaUserToken;
      await saveConfig(config);
      const mode = getOutputMode(program.opts());
      if (mode === "json") {
        outputJson({ success: true });
      } else {
        outputMessage("Credentials cleared");
      }
    });
}
