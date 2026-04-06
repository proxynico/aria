import type {
  EngineCapabilities,
  MusicEngine,
  Track,
  Album,
  Artist,
  Playlist,
  PlaylistDetails,
  PlaybackState,
  SearchResults,
  SearchType,
  Device,
} from "../lib/types";
import { getMediaUserToken, loadConfig } from "../lib/config";
import { buildIdentity, parseEntityRef } from "../lib/entities";
import { AuthError, ExternalServiceError, UnsupportedOperationError } from "../lib/errors";

const AMP_API_BASE = "https://amp-api.music.apple.com/v1";
const WEBPLAYER_TOKEN_URL = "https://music.apple.com";

/**
 * Apple Music web API engine.
 * Uses the media-user-token from browser cookies to authenticate against
 * Apple's internal amp-api.music.apple.com endpoints.
 *
 * This is the Apple Music equivalent of Spogo's cookie-based Spotify approach.
 * No official API key needed — just browser cookies.
 */

// The Apple Music web player embeds a JWT developer token in its JS bundle.
// We extract it once and cache it.
let cachedDevToken: string | null = null;
let cachedStorefront: string | null = null;

async function getWebPlayerDevToken(): Promise<string> {
  if (cachedDevToken) return cachedDevToken;

  // Fetch the Apple Music web player and extract the embedded token
  const res = await fetch(WEBPLAYER_TOKEN_URL);
  const html = await res.text();

  // The token is embedded in the page's JS assets. Look for the JWT pattern.
  // Apple embeds it as a constant in their webpack bundles.
  // Pattern: eyJhbGciOi... (JWT format, base64url)
  const jwtMatch = html.match(/eyJhbGciOi[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  if (jwtMatch) {
    cachedDevToken = jwtMatch[0];
    return cachedDevToken;
  }

  // If not in the main HTML, try fetching JS assets
  const jsUrls = html.match(/https:\/\/[^"']+\.js/g) || [];
  for (const url of jsUrls.slice(0, 5)) {
    try {
      const jsRes = await fetch(url);
      const js = await jsRes.text();
      const match = js.match(/eyJhbGciOi[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
      if (match) {
        cachedDevToken = match[0];
        return cachedDevToken;
      }
    } catch {
      continue;
    }
  }

  throw new ExternalServiceError(
    "Could not extract the Apple Music developer token from the web player.",
    "Apple may have changed the web player. Use `--engine native` if you only need Music.app control.",
  );
}

async function apiRequest<T>(
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  const mediaUserToken = await getMediaUserToken();
  if (!mediaUserToken) {
    throw new AuthError(
      "No Apple Music media-user-token is configured.",
      "Run `aria auth import --browser safari` or `aria auth token <token>`.",
    );
  }

  const devToken = await getWebPlayerDevToken();
  const url = new URL(`${AMP_API_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      "Authorization": `Bearer ${devToken}`,
      "Media-User-Token": mediaUserToken,
      "Origin": "https://music.apple.com",
      "Referer": "https://music.apple.com/",
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new AuthError(
        "Apple Music authentication failed. The media-user-token may be expired.",
        "Re-import it with `aria auth import --browser safari`.",
      );
    }
    throw new ExternalServiceError(`Apple Music API error: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

// ── Response types for Apple Music API ──

interface AMResource {
  id: string;
  type: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, { data: AMResource[] }>;
}

interface AMResponse {
  results?: {
    songs?: { data: AMResource[] };
    albums?: { data: AMResource[] };
    artists?: { data: AMResource[] };
    playlists?: { data: AMResource[] };
  };
  data?: AMResource[];
}

function parseApiTrack(r: AMResource): Track {
  const a = r.attributes || {};
  const playParams = (a.playParams as Record<string, unknown> | undefined) || {};
  const catalogId = (playParams.catalogId as string | undefined)
    || (playParams.id as string | undefined)
    || (r.type === "songs" ? r.id : undefined);
  const libraryId = r.type.startsWith("library-") ? r.id : undefined;
  return {
    ...buildIdentity({
      source: "api",
      libraryId,
      catalogId,
    }),
    name: (a.name as string) || "Unknown",
    artist: (a.artistName as string) || "Unknown",
    album: (a.albumName as string) || "",
    duration: Math.round(((a.durationInMillis as number) || 0) / 1000),
    trackNumber: (a.trackNumber as number) || undefined,
    genre: ((a.genreNames as string[]) || [])[0] || undefined,
    year: a.releaseDate ? parseInt(String(a.releaseDate).slice(0, 4), 10) : undefined,
    artworkUrl: formatArtwork(a.artwork as { url?: string } | undefined),
  };
}

function parseApiAlbum(r: AMResource): Album {
  const a = r.attributes || {};
  const playParams = (a.playParams as Record<string, unknown> | undefined) || {};
  const catalogId = (playParams.catalogId as string | undefined)
    || (playParams.id as string | undefined)
    || (r.type === "albums" ? r.id : undefined);
  const libraryId = r.type.startsWith("library-") ? r.id : undefined;
  return {
    ...buildIdentity({
      source: "api",
      libraryId,
      catalogId,
    }),
    name: (a.name as string) || "Unknown",
    artist: (a.artistName as string) || "Unknown",
    trackCount: (a.trackCount as number) || 0,
    year: a.releaseDate ? parseInt(String(a.releaseDate).slice(0, 4), 10) : undefined,
    genre: ((a.genreNames as string[]) || [])[0] || undefined,
    artworkUrl: formatArtwork(a.artwork as { url?: string } | undefined),
  };
}

function parseApiArtist(r: AMResource): Artist {
  const a = r.attributes || {};
  const catalogId = r.type === "artists" ? r.id : undefined;
  return {
    ...buildIdentity({
      source: "api",
      libraryId: r.type.startsWith("library-") ? r.id : undefined,
      catalogId,
    }),
    name: (a.name as string) || "Unknown",
    genre: ((a.genreNames as string[]) || [])[0] || undefined,
    artworkUrl: formatArtwork(a.artwork as { url?: string } | undefined),
  };
}

function parseApiPlaylist(r: AMResource): Playlist {
  const a = r.attributes || {};
  const playParams = (a.playParams as Record<string, unknown> | undefined) || {};
  const catalogId = (playParams.catalogId as string | undefined)
    || (playParams.globalId as string | undefined)
    || (r.type === "playlists" ? r.id : undefined);
  const libraryId = r.type.startsWith("library-") ? r.id : undefined;
  return {
    ...buildIdentity({
      source: "api",
      libraryId,
      catalogId,
    }),
    name: (a.name as string) || "Unknown",
    description: (a.description as { short?: string })?.short || undefined,
    trackCount: 0, // Not always in the response
  };
}

function formatArtwork(artwork?: { url?: string }): string | undefined {
  if (!artwork?.url) return undefined;
  return artwork.url.replace("{w}", "300").replace("{h}", "300");
}

export class ApiEngine implements MusicEngine {
  name = "api";
  capabilities: EngineCapabilities = {
    playback: false,
    queue: false,
    playlistMutation: false,
    devices: false,
    catalogSearch: true,
    libraryRead: true,
    shuffle: false,
    repeat: false,
  };

  private async getStorefront(): Promise<string> {
    if (cachedStorefront) return cachedStorefront;
    const config = await loadConfig();
    if (config.storefront && config.storefront !== "auto") {
      cachedStorefront = config.storefront;
      return cachedStorefront;
    }

    try {
      const data = await apiRequest<AMResponse>("/me/storefront");
      const storefront = data.data?.[0]?.id;
      cachedStorefront = storefront || "us";
      return cachedStorefront;
    } catch {
      cachedStorefront = "us";
      return cachedStorefront;
    }
  }

  // ── Playback (not supported via API — delegate to native) ──
  // The Apple Music API is a catalog/library API, not a playback control API.
  // Playback must go through Music.app (native engine).

  async play(_query?: string): Promise<void> {
    throw new UnsupportedOperationError("Playback control requires the native engine.", "Use `aria --engine native play`.");
  }

  async pause(): Promise<void> {
    throw new UnsupportedOperationError("Playback control requires the native engine.", "Use `aria --engine native pause`.");
  }

  async resume(): Promise<void> {
    throw new UnsupportedOperationError("Playback control requires the native engine.", "Use `aria --engine native resume`.");
  }

  async next(): Promise<void> {
    throw new UnsupportedOperationError("Playback control requires the native engine.", "Use `aria --engine native next`.");
  }

  async previous(): Promise<void> {
    throw new UnsupportedOperationError("Playback control requires the native engine.", "Use `aria --engine native prev`.");
  }

  async seek(_seconds: number): Promise<void> {
    throw new UnsupportedOperationError("Playback control requires the native engine.");
  }

  async setVolume(_level: number): Promise<void> {
    throw new UnsupportedOperationError("Volume control requires the native engine.");
  }

  async getVolume(): Promise<number> {
    throw new UnsupportedOperationError("Volume requires the native engine.");
  }

  async setShuffle(_enabled: boolean): Promise<void> {
    throw new UnsupportedOperationError("Shuffle requires the native engine.");
  }

  async getShuffle(): Promise<boolean> {
    throw new UnsupportedOperationError("Shuffle requires the native engine.");
  }

  async setRepeat(_mode: "off" | "one" | "all"): Promise<void> {
    throw new UnsupportedOperationError("Repeat mode requires the native engine.");
  }

  async getRepeat(): Promise<"off" | "one" | "all"> {
    throw new UnsupportedOperationError("Repeat mode requires the native engine.");
  }

  async getStatus(): Promise<PlaybackState> {
    throw new UnsupportedOperationError("Playback status requires the native engine.");
  }

  // ── Search (catalog) ──

  async search(query: string, types: SearchType[], limit = 20): Promise<SearchResults> {
    const typeMap: Record<SearchType, string> = {
      track: "songs",
      album: "albums",
      artist: "artists",
      playlist: "playlists",
    };

    const amTypes = (types.length > 0 ? types : ["track", "album", "artist"] as SearchType[])
      .map(t => typeMap[t])
      .join(",");

    const storefront = await this.getStorefront();
    const data = await apiRequest<AMResponse>(`/catalog/${storefront}/search`, {
      term: query,
      types: amTypes,
      limit: String(limit),
    });

    const results: SearchResults = { tracks: [], albums: [], artists: [], playlists: [] };

    if (data.results?.songs?.data) {
      results.tracks = data.results.songs.data.map(parseApiTrack);
    }
    if (data.results?.albums?.data) {
      results.albums = data.results.albums.data.map(parseApiAlbum);
    }
    if (data.results?.artists?.data) {
      results.artists = data.results.artists.data.map(parseApiArtist);
    }
    if (data.results?.playlists?.data) {
      results.playlists = data.results.playlists.data.map(parseApiPlaylist);
    }

    return results;
  }

  // ── Queue (not supported via API) ──

  async addToQueue(_trackId: string): Promise<void> {
    throw new UnsupportedOperationError("Queue management requires the native engine.");
  }

  // ── Library ──

  async getPlaylists(): Promise<Playlist[]> {
    const data = await apiRequest<AMResponse>("/me/library/playlists", {
      limit: "100",
    });
    return (data.data || []).map(parseApiPlaylist);
  }

  async getPlaylistTracks(playlistId: string): Promise<Track[]> {
    const playlistRef = parseEntityRef(playlistId);
    const apiPlaylistId = playlistRef?.kind === "library" ? playlistRef.value : playlistId;
    const data = await apiRequest<AMResponse>(`/me/library/playlists/${apiPlaylistId}/tracks`, {
      limit: "100",
    });
    return (data.data || []).map(parseApiTrack);
  }

  async getPlaylistInfo(playlistId: string): Promise<PlaylistDetails> {
    const playlistRef = parseEntityRef(playlistId);
    const apiPlaylistId = playlistRef?.kind === "library" ? playlistRef.value : playlistId;
    const data = await apiRequest<AMResponse>(`/me/library/playlists/${apiPlaylistId}`, {});
    const playlist = data.data?.[0];
    const a = playlist?.attributes || {};
    const tracks = await this.getPlaylistTracks(apiPlaylistId);
    const playParams = (a.playParams as Record<string, unknown> | undefined) || {};

    const artistCounts = new Map<string, number>();
    const genreCounts = new Map<string, number>();
    for (const t of tracks) {
      artistCounts.set(t.artist, (artistCounts.get(t.artist) || 0) + 1);
      genreCounts.set(t.genre || "Unknown", (genreCounts.get(t.genre || "Unknown") || 0) + 1);
    }

    return {
      ...buildIdentity({
        source: "api",
        libraryId: apiPlaylistId,
        catalogId: (playParams.catalogId as string | undefined) || (playParams.globalId as string | undefined),
      }),
      name: (a.name as string) || "Unknown",
      description: (a.description as { short?: string })?.short || undefined,
      trackCount: tracks.length,
      totalDuration: tracks.reduce((sum, t) => sum + t.duration, 0),
      artworkUrl: formatArtwork(a.artwork as { url?: string } | undefined),
      tracks,
      topArtists: Array.from(artistCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name, count]) => ({ name, count })),
      genres: Array.from(genreCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count })),
    };
  }

  async addToPlaylist(_playlistId: string, _trackIds: string[]): Promise<void> {
    throw new UnsupportedOperationError("Playlist editing via API is not implemented.", "Use `--engine native` with native persistent IDs.");
  }

  async removeFromPlaylist(_playlistId: string, _trackIds: string[]): Promise<void> {
    throw new UnsupportedOperationError("Playlist editing via API is not implemented.", "Use `--engine native` with native persistent IDs.");
  }

  async getLibraryTracks(limit = 50, offset = 0): Promise<Track[]> {
    const data = await apiRequest<AMResponse>("/me/library/songs", {
      limit: String(limit),
      offset: String(offset),
    });
    return (data.data || []).map(parseApiTrack);
  }

  async getLibraryAlbums(limit = 50, offset = 0): Promise<Album[]> {
    const data = await apiRequest<AMResponse>("/me/library/albums", {
      limit: String(limit),
      offset: String(offset),
    });
    return (data.data || []).map(parseApiAlbum);
  }

  // ── Devices (not available via API) ──

  async getDevices(): Promise<Device[]> {
    throw new UnsupportedOperationError("Device listing requires the native engine.");
  }
}
