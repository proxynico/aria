import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import type { AriaConfig } from "./types";
import { getMediaUserTokenSecret, setMediaUserTokenSecret, clearMediaUserTokenSecret } from "./secrets";

const CONFIG_DIR = join(homedir(), ".config", "aria");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

const DEFAULT_CONFIG: AriaConfig = {
  defaultEngine: "auto",
  storefront: "auto",
};

export async function getConfigDir(): Promise<string> {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
  return CONFIG_DIR;
}

export async function loadConfig(): Promise<AriaConfig> {
  try {
    const raw = await readFile(CONFIG_FILE, "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(config: AriaConfig): Promise<void> {
  await getConfigDir();
  try {
    await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n");
  } catch (err) {
    throw new Error(`Failed to save config to ${CONFIG_FILE}: ${(err as Error).message}`);
  }
}

export async function getMediaUserToken(): Promise<string | undefined> {
  return getMediaUserTokenSecret();
}

export async function setMediaUserToken(token: string): Promise<void> {
  await setMediaUserTokenSecret(token);
}

export async function clearMediaUserToken(): Promise<void> {
  await clearMediaUserTokenSecret();
}

export async function setDefaultEngine(defaultEngine: AriaConfig["defaultEngine"]): Promise<void> {
  const config = await loadConfig();
  config.defaultEngine = defaultEngine;
  await saveConfig(config);
}

export async function setStorefront(storefront: string): Promise<void> {
  const config = await loadConfig();
  config.storefront = storefront;
  await saveConfig(config);
}
