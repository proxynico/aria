import { $ } from "bun";
import { AuthError } from "./errors";

const SERVICE = "cider-music";
const LEGACY_SERVICE = "aria-music";
const ACCOUNT = "media-user-token";

async function readToken(service: string): Promise<string | undefined> {
  const result = await $`security find-generic-password -s ${service} -a ${ACCOUNT} -w`.quiet().nothrow();
  if (result.exitCode === 0) {
    const token = result.stdout.toString().trim();
    return token || undefined;
  }

  return undefined;
}

export async function getMediaUserTokenSecret(): Promise<string | undefined> {
  return (await readToken(SERVICE)) ?? (await readToken(LEGACY_SERVICE));
}

export async function setMediaUserTokenSecret(token: string): Promise<void> {
  await $`security delete-generic-password -s ${SERVICE} -a ${ACCOUNT}`.quiet().nothrow();

  const addResult = await $`security add-generic-password -U -s ${SERVICE} -a ${ACCOUNT} -w ${token}`.quiet().nothrow();
  if (addResult.exitCode !== 0) {
    throw new AuthError(
      "Failed to save the Apple Music token to Keychain",
      "Grant Terminal access to Keychain if prompted, or re-run `cider-music auth token <token>`.",
    );
  }
}

export async function clearMediaUserTokenSecret(): Promise<void> {
  await $`security delete-generic-password -s ${SERVICE} -a ${ACCOUNT}`.quiet().nothrow();
  await $`security delete-generic-password -s ${LEGACY_SERVICE} -a ${ACCOUNT}`.quiet().nothrow();
}
