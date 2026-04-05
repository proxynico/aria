import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import type { AriaConfig } from "./types";

const CONFIG_DIR = join(homedir(), ".config", "aria");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

const DEFAULT_CONFIG: AriaConfig = {
  defaultEngine: "native",
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
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n");
}

export async function getMediaUserToken(): Promise<string | undefined> {
  const config = await loadConfig();
  return config.mediaUserToken;
}

export async function setMediaUserToken(token: string): Promise<void> {
  const config = await loadConfig();
  config.mediaUserToken = token;
  await saveConfig(config);
}
