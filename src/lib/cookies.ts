import { $ } from "bun";
import { setMediaUserToken } from "./config";

/**
 * Extract the media-user-token cookie from a browser's cookie store.
 * This is the Apple Music equivalent of Spogo's sp_dc/sp_key cookie import.
 *
 * The media-user-token is set when you log into music.apple.com.
 * It authenticates requests to amp-api.music.apple.com.
 */

type Browser = "safari" | "chrome" | "firefox" | "edge" | "brave";

const COOKIE_NAME = "media-user-token";
const DOMAIN = "apple.com";

export async function importCookiesFromBrowser(browser: Browser): Promise<string> {
  switch (browser) {
    case "safari":
      return importSafariCookie();
    case "chrome":
    case "edge":
    case "brave":
      return importChromiumCookie(browser);
    case "firefox":
      return importFirefoxCookie();
    default:
      throw new Error(`Unsupported browser: ${browser}`);
  }
}

async function importSafariCookie(): Promise<string> {
  // Safari cookies are in a binary cookie file.
  // We can use a Python one-liner or the `sqlite3` approach on the Cookies.binarycookies
  // But the most reliable macOS approach is using the `security` framework or
  // directly reading the Safari cookie database.

  // Safari stores cookies in ~/Library/Cookies/Cookies.binarycookies (binary format)
  // and also in ~/Library/Containers/com.apple.Safari/Data/Library/Cookies/

  // Simplest approach: use osascript to run JavaScript that reads from Safari
  // Actually, the most reliable approach is using sqlite3 on the cookies DB

  // Safari on modern macOS uses a SQLite database
  const cookieDbPaths = [
    "~/Library/Containers/com.apple.Safari/Data/Library/Cookies/Cookies.db",
    "~/Library/Cookies/Cookies.db",
  ];

  for (const dbPath of cookieDbPaths) {
    const expanded = dbPath.replace("~", process.env.HOME || "");
    try {
      const result = await $`sqlite3 ${expanded} "SELECT value FROM cookies WHERE name='${COOKIE_NAME}' AND domain LIKE '%${DOMAIN}%' LIMIT 1;"`.quiet().nothrow();
      const token = result.stdout.toString().trim();
      if (token) {
        await setMediaUserToken(token);
        return token;
      }
    } catch {
      continue;
    }
  }

  throw new Error(
    "Could not extract media-user-token from Safari.\n" +
    "Make sure you're logged into music.apple.com in Safari.\n" +
    "You may need to grant Full Disk Access to Terminal in System Settings > Privacy.\n\n" +
    "Alternatively, paste the token manually:\n" +
    "  1. Open music.apple.com in Safari\n" +
    "  2. Open Web Inspector (Develop > Show Web Inspector)\n" +
    "  3. Go to Storage > Cookies\n" +
    "  4. Find 'media-user-token' and copy its value\n" +
    "  5. Run: aria auth token <paste-token-here>"
  );
}

async function importChromiumCookie(browser: Browser): Promise<string> {
  // Chromium-based browsers store cookies in an encrypted SQLite database.
  // On macOS, the encryption key is in Keychain.

  const profilePaths: Record<string, string> = {
    chrome: "~/Library/Application Support/Google/Chrome/Default/Cookies",
    edge: "~/Library/Application Support/Microsoft Edge/Default/Cookies",
    brave: "~/Library/Application Support/BraveSoftware/Brave-Browser/Default/Cookies",
  };

  const dbPath = (profilePaths[browser] || "").replace("~", process.env.HOME || "");

  // Chromium cookies are encrypted with a key from Keychain.
  // We need to decrypt them. Use a Python script for this.
  const script = `
import sqlite3, subprocess, base64, os, sys
from hashlib import pbkdf2_hmac
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

db_path = "${dbPath}"
if not os.path.exists(db_path):
    sys.exit(1)

# Get encryption key from Keychain
browser_name = {"chrome": "Chrome", "edge": "Microsoft Edge", "brave": "Brave"}["${browser}"]
key_cmd = subprocess.run(
    ["security", "find-generic-password", "-s", f"{browser_name} Safe Storage", "-w"],
    capture_output=True, text=True
)
if key_cmd.returncode != 0:
    sys.exit(1)

key = pbkdf2_hmac("sha1", key_cmd.stdout.strip().encode(), b"saltysalt", 1003, 16)

conn = sqlite3.connect(db_path)
cursor = conn.execute(
    "SELECT encrypted_value FROM cookies WHERE name=? AND host_key LIKE ?",
    ("${COOKIE_NAME}", "%${DOMAIN}%")
)
row = cursor.fetchone()
conn.close()

if not row or not row[0]:
    sys.exit(1)

encrypted = row[0]
if encrypted[:3] == b"v10":
    iv = b" " * 16
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
    decryptor = cipher.decryptor()
    decrypted = decryptor.update(encrypted[3:]) + decryptor.finalize()
    # Remove PKCS7 padding
    pad_len = decrypted[-1]
    print(decrypted[:-pad_len].decode("utf-8"))
else:
    print(encrypted.decode("utf-8"))
`;

  try {
    const result = await $`python3 -c ${script}`.quiet().nothrow();
    const token = result.stdout.toString().trim();
    if (token && result.exitCode === 0) {
      await setMediaUserToken(token);
      return token;
    }
  } catch {
    // Fall through
  }

  throw new Error(
    `Could not extract media-user-token from ${browser}.\n` +
    "Make sure you're logged into music.apple.com.\n" +
    "You may need the 'cryptography' Python package: pip3 install cryptography\n\n" +
    "Alternatively, paste the token manually:\n" +
    `  1. Open music.apple.com in ${browser}\n` +
    "  2. Open DevTools (Cmd+Option+I) > Application > Cookies\n" +
    "  3. Find 'media-user-token' and copy its value\n" +
    "  4. Run: aria auth token <paste-token-here>"
  );
}

async function importFirefoxCookie(): Promise<string> {
  // Firefox cookies are in an unencrypted SQLite database
  const profileDir = "~/Library/Application Support/Firefox/Profiles".replace("~", process.env.HOME || "");

  try {
    const result = await $`find ${profileDir} -name "cookies.sqlite" -maxdepth 2`.quiet().nothrow();
    const dbPaths = result.stdout.toString().trim().split("\n").filter(Boolean);

    for (const dbPath of dbPaths) {
      const queryResult = await $`sqlite3 ${dbPath} "SELECT value FROM moz_cookies WHERE name='${COOKIE_NAME}' AND baseDomain LIKE '%${DOMAIN}%' LIMIT 1;"`.quiet().nothrow();
      const token = queryResult.stdout.toString().trim();
      if (token) {
        await setMediaUserToken(token);
        return token;
      }
    }
  } catch {
    // Fall through
  }

  throw new Error(
    "Could not extract media-user-token from Firefox.\n" +
    "Make sure you're logged into music.apple.com in Firefox.\n\n" +
    "Alternatively, paste the token manually:\n" +
    "  1. Open music.apple.com in Firefox\n" +
    "  2. Open DevTools (Cmd+Option+I) > Storage > Cookies\n" +
    "  3. Find 'media-user-token' and copy its value\n" +
    "  4. Run: aria auth token <paste-token-here>"
  );
}

export const SUPPORTED_BROWSERS: Browser[] = ["safari", "chrome", "firefox", "edge", "brave"];
