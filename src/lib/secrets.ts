import { $ } from "bun";
import { AuthError, ExternalServiceError } from "./errors";

const SERVICE = "aria-music";
const ACCOUNT = "media-user-token";

export async function getMediaUserTokenSecret(): Promise<string | undefined> {
  const result = await $`security find-generic-password -s ${SERVICE} -a ${ACCOUNT} -w`.quiet().nothrow();
  if (result.exitCode === 0) {
    const token = result.stdout.toString().trim();
    return token || undefined;
  }

  return undefined;
}

export async function setMediaUserTokenSecret(token: string): Promise<void> {
  const existing = await getMediaUserTokenSecret();
  if (existing !== undefined) {
    const deleteResult = await $`security delete-generic-password -s ${SERVICE} -a ${ACCOUNT}`.quiet().nothrow();
    if (deleteResult.exitCode !== 0) {
      throw new ExternalServiceError("Failed to replace existing Apple Music token in Keychain");
    }
  }

  const addResult = await $`security add-generic-password -U -s ${SERVICE} -a ${ACCOUNT} -w ${token}`.quiet().nothrow();
  if (addResult.exitCode !== 0) {
    throw new AuthError(
      "Failed to save the Apple Music token to Keychain",
      "Grant Terminal access to Keychain if prompted, or re-run `aria auth token <token>`.",
    );
  }
}

export async function clearMediaUserTokenSecret(): Promise<void> {
  await $`security delete-generic-password -s ${SERVICE} -a ${ACCOUNT}`.quiet().nothrow();
}
