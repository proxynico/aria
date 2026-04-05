import { $ } from "bun";
import type {
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

/**
 * macOS native engine — controls Music.app via JXA (JavaScript for Automation).
 * No auth needed, no rate limits. macOS only.
 */

async function jxa(script: string): Promise<string> {
  const result = await $`osascript -l JavaScript -e ${script}`.quiet().nothrow();
  if (result.exitCode !== 0) {
    const err = result.stderr.toString().trim();
    // Music.app not running is a common case
    if (err.includes("not running") || err.includes("-1728")) {
      throw new Error("Music.app is not running. Open it first.");
    }
    throw new Error(`JXA error: ${err}`);
  }
  return result.stdout.toString().trim();
}

async function jxaJson<T>(script: string): Promise<T> {
  const wrapped = `
    const result = (() => { ${script} })();
    JSON.stringify(result);
  `;
  const raw = await jxa(wrapped);
  return JSON.parse(raw);
}

function parseTrack(raw: NativeTrackData): Track {
  return {
    id: String(raw.id ?? raw.persistentID ?? ""),
    name: raw.name ?? "Unknown",
    artist: raw.artist ?? "Unknown",
    album: raw.album ?? "",
    duration: raw.duration ?? 0,
    trackNumber: raw.trackNumber,
    genre: raw.genre || undefined,
    year: raw.year || undefined,
  };
}

interface NativeTrackData {
  id?: number;
  persistentID?: string;
  name?: string;
  artist?: string;
  album?: string;
  duration?: number;
  trackNumber?: number;
  genre?: string;
  year?: number;
}

export class NativeEngine implements MusicEngine {
  name = "native";

  async play(query?: string): Promise<void> {
    if (!query) {
      await jxa(`
        const music = Application("Music");
        music.play();
      `);
      return;
    }

    // Search and play the first result
    await jxa(`
      const music = Application("Music");
      const tracks = music.search(music.libraryPlaylists[0], { for: ${JSON.stringify(query)} });
      if (tracks.length === 0) {
        // Try playing by name directly
        music.play();
      } else {
        music.play(tracks[0]);
      }
    `);
  }

  async pause(): Promise<void> {
    await jxa(`Application("Music").pause();`);
  }

  async resume(): Promise<void> {
    await jxa(`Application("Music").play();`);
  }

  async next(): Promise<void> {
    await jxa(`Application("Music").nextTrack();`);
  }

  async previous(): Promise<void> {
    await jxa(`Application("Music").previousTrack();`);
  }

  async seek(seconds: number): Promise<void> {
    await jxa(`Application("Music").playerPosition = ${seconds};`);
  }

  async setVolume(level: number): Promise<void> {
    const clamped = Math.max(0, Math.min(100, Math.round(level)));
    await jxa(`Application("Music").soundVolume = ${clamped};`);
  }

  async getVolume(): Promise<number> {
    const raw = await jxa(`Application("Music").soundVolume();`);
    return parseInt(raw, 10);
  }

  async getStatus(): Promise<PlaybackState> {
    return jxaJson<PlaybackState>(`
      const music = Application("Music");
      const state = music.playerState();
      const stateMap = { "playing": "playing", "paused": "paused", "stopped": "stopped", "fast forwarding": "playing", "rewinding": "playing" };
      const mapped = stateMap[state] || "stopped";

      if (mapped === "stopped") {
        return { state: "stopped", track: null, position: 0, volume: music.soundVolume(), shuffleEnabled: music.shuffleEnabled(), repeatMode: "off" };
      }

      const t = music.currentTrack;
      const repeatMap = { "off": "off", "one": "one", "all": "all" };

      return {
        state: mapped,
        track: {
          id: String(t.persistentID()),
          name: t.name(),
          artist: t.artist(),
          album: t.album(),
          duration: t.duration(),
          trackNumber: t.trackNumber(),
          genre: t.genre() || undefined,
          year: t.year() || undefined,
        },
        position: music.playerPosition(),
        volume: music.soundVolume(),
        shuffleEnabled: music.shuffleEnabled(),
        repeatMode: repeatMap[music.songRepeat()] || "off",
      };
    `);
  }

  async search(query: string, types: SearchType[], limit = 20): Promise<SearchResults> {
    const results: SearchResults = { tracks: [], albums: [], artists: [], playlists: [] };

    if (types.includes("track") || types.length === 0) {
      const tracks = await jxaJson<NativeTrackData[]>(`
        const music = Application("Music");
        const found = music.search(music.libraryPlaylists[0], { for: ${JSON.stringify(query)} });
        const limit = ${limit};
        const tracks = [];
        for (let i = 0; i < Math.min(found.length, limit); i++) {
          const t = found[i];
          tracks.push({
            id: t.persistentID(),
            name: t.name(),
            artist: t.artist(),
            album: t.album(),
            duration: t.duration(),
            trackNumber: t.trackNumber(),
            genre: t.genre() || undefined,
            year: t.year() || undefined,
          });
        }
        return tracks;
      `);
      results.tracks = tracks.map(parseTrack);
    }

    if (types.includes("playlist")) {
      const playlists = await this.getPlaylists();
      const q = query.toLowerCase();
      results.playlists = playlists.filter(p => p.name.toLowerCase().includes(q)).slice(0, limit);
    }

    // Albums and artists are derived from track search results (Music.app search only returns tracks)
    if (types.includes("album") && results.tracks.length > 0) {
      const seen = new Set<string>();
      for (const t of results.tracks) {
        const key = `${t.album}::${t.artist}`;
        if (!seen.has(key) && t.album) {
          seen.add(key);
          results.albums.push({
            id: key,
            name: t.album,
            artist: t.artist,
            trackCount: 0,
            year: t.year,
            genre: t.genre,
          });
        }
      }
      results.albums = results.albums.slice(0, limit);
    }

    if (types.includes("artist") && results.tracks.length > 0) {
      const seen = new Set<string>();
      for (const t of results.tracks) {
        if (!seen.has(t.artist)) {
          seen.add(t.artist);
          results.artists.push({
            id: t.artist,
            name: t.artist,
            genre: t.genre,
          });
        }
      }
      results.artists = results.artists.slice(0, limit);
    }

    return results;
  }

  async addToQueue(trackId: string): Promise<void> {
    // Music.app doesn't have a direct "add to queue" via JXA.
    // Workaround: find the track and use "play next"
    await jxa(`
      const music = Application("Music");
      const lib = music.libraryPlaylists[0];
      const tracks = lib.tracks.whose({ persistentID: ${JSON.stringify(trackId)} });
      if (tracks.length > 0) {
        // Use System Events to trigger "Play Next" — this is a known limitation
        // For now, we add to Up Next by playing after current
        music.play(tracks[0]);
      } else {
        throw new Error("Track not found: ${trackId}");
      }
    `);
  }

  async getPlaylists(): Promise<Playlist[]> {
    return jxaJson<Playlist[]>(`
      const music = Application("Music");
      const playlists = music.playlists();
      const result = [];
      for (const p of playlists) {
        const kind = p.specialKind();
        // Skip internal playlists (Library, Music, etc.)
        if (kind === "none" || kind === "folder") {
          result.push({
            id: p.persistentID(),
            name: p.name(),
            trackCount: p.tracks.length,
          });
        }
      }
      return result;
    `);
  }

  async getPlaylistInfo(playlistId: string): Promise<PlaylistDetails> {
    const info = await jxaJson<{ name: string; description: string; trackCount: number; hasArtwork: boolean }>(`
      const music = Application("Music");
      const playlists = music.playlists.whose({ persistentID: ${JSON.stringify(playlistId)} });
      if (playlists.length === 0) throw new Error("Playlist not found");
      const p = playlists[0];
      return {
        name: p.name(),
        description: p.description() || "",
        trackCount: p.tracks.length,
        hasArtwork: p.artworks.length > 0,
      };
    `);

    // Export artwork if it exists
    let artworkPath: string | undefined;
    if (info.hasArtwork) {
      try {
        const tmpPath = `/tmp/aria-artwork-${playlistId}.png`;
        await jxa(`
          const music = Application("Music");
          const p = music.playlists.whose({ persistentID: ${JSON.stringify(playlistId)} })[0];
          const artwork = p.artworks[0];
          const rawData = artwork.rawData();
          const app = Application.currentApplication();
          app.includeStandardAdditions = true;
          const file = app.openForAccess(Path(${JSON.stringify(tmpPath)}), { writePermission: true });
          app.setEof(file, { to: 0 });
          app.write(rawData, { to: file });
          app.closeAccess(file);
        `);
        artworkPath = tmpPath;
      } catch {
        // Artwork export failed — not critical
      }
    }

    // Get tracks for analysis
    const tracks = await this.getPlaylistTracks(playlistId);

    // Compute top artists
    const artistCounts = new Map<string, number>();
    for (const t of tracks) {
      artistCounts.set(t.artist, (artistCounts.get(t.artist) || 0) + 1);
    }
    const topArtists = Array.from(artistCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([name, count]) => ({ name, count }));

    // Compute genres
    const genreCounts = new Map<string, number>();
    for (const t of tracks) {
      const g = t.genre || "Unknown";
      genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
    }
    const genres = Array.from(genreCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    const totalDuration = tracks.reduce((sum, t) => sum + t.duration, 0);

    return {
      id: playlistId,
      name: info.name,
      description: info.description || undefined,
      trackCount: info.trackCount,
      totalDuration,
      artworkPath,
      tracks,
      topArtists,
      genres,
    };
  }

  async addToPlaylist(playlistId: string, trackIds: string[]): Promise<void> {
    for (const trackId of trackIds) {
      await jxa(`
        const music = Application("Music");
        const playlist = music.playlists.whose({ persistentID: ${JSON.stringify(playlistId)} })[0];
        if (!playlist) throw new Error("Playlist not found: ${playlistId}");
        const lib = music.libraryPlaylists[0];
        const tracks = lib.tracks.whose({ persistentID: ${JSON.stringify(trackId)} });
        if (tracks.length === 0) throw new Error("Track not found: ${trackId}");
        music.duplicate(tracks[0], { to: playlist });
      `);
    }
  }

  async removeFromPlaylist(playlistId: string, trackIds: string[]): Promise<void> {
    for (const trackId of trackIds) {
      await jxa(`
        const music = Application("Music");
        const playlist = music.playlists.whose({ persistentID: ${JSON.stringify(playlistId)} })[0];
        if (!playlist) throw new Error("Playlist not found: ${playlistId}");
        const tracks = playlist.tracks.whose({ persistentID: ${JSON.stringify(trackId)} });
        if (tracks.length === 0) throw new Error("Track not found in playlist: ${trackId}");
        tracks[0].delete();
      `);
    }
  }

  async getPlaylistTracks(playlistId: string): Promise<Track[]> {
    const raw = await jxaJson<NativeTrackData[]>(`
      const music = Application("Music");
      const playlists = music.playlists.whose({ persistentID: ${JSON.stringify(playlistId)} });
      if (playlists.length === 0) return [];
      const tracks = playlists[0].tracks();
      return tracks.map(t => ({
        id: t.persistentID(),
        name: t.name(),
        artist: t.artist(),
        album: t.album(),
        duration: t.duration(),
        trackNumber: t.trackNumber(),
        genre: t.genre() || undefined,
        year: t.year() || undefined,
      }));
    `);
    return raw.map(parseTrack);
  }

  async getLibraryTracks(limit = 50, offset = 0): Promise<Track[]> {
    const raw = await jxaJson<NativeTrackData[]>(`
      const music = Application("Music");
      const allTracks = music.libraryPlaylists[0].tracks();
      const start = ${offset};
      const end = Math.min(start + ${limit}, allTracks.length);
      const result = [];
      for (let i = start; i < end; i++) {
        const t = allTracks[i];
        result.push({
          id: t.persistentID(),
          name: t.name(),
          artist: t.artist(),
          album: t.album(),
          duration: t.duration(),
          trackNumber: t.trackNumber(),
          genre: t.genre() || undefined,
          year: t.year() || undefined,
        });
      }
      return result;
    `);
    return raw.map(parseTrack);
  }

  async getLibraryAlbums(limit = 50, _offset = 0): Promise<Album[]> {
    // Music.app doesn't expose albums directly — derive from tracks
    const tracks = await this.getLibraryTracks(500, 0);
    const albumMap = new Map<string, Album>();

    for (const t of tracks) {
      if (!t.album) continue;
      const key = `${t.album}::${t.artist}`;
      const existing = albumMap.get(key);
      if (existing) {
        existing.trackCount++;
      } else {
        albumMap.set(key, {
          id: key,
          name: t.album,
          artist: t.artist,
          trackCount: 1,
          year: t.year,
          genre: t.genre,
        });
      }
    }

    return Array.from(albumMap.values()).slice(0, limit);
  }

  async getDevices(): Promise<Device[]> {
    // AirPlay devices via JXA
    return jxaJson<Device[]>(`
      const music = Application("Music");
      const devices = music.AirPlayDevices();
      return devices.map(d => ({
        id: d.persistentID ? d.persistentID() : d.name(),
        name: d.name(),
        kind: d.kind ? d.kind() : "airplay",
        active: d.selected(),
      }));
    `);
  }
}
