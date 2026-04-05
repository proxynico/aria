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
import { NativeEngine } from "./native";
import { ApiEngine } from "./api";
import { getMediaUserToken } from "../lib/config";

/**
 * Auto engine — uses native for playback, API for catalog search when available.
 * Falls back gracefully: if API auth isn't set up, everything goes through native.
 */
export class AutoEngine implements MusicEngine {
  name = "auto";
  private native = new NativeEngine();
  private api = new ApiEngine();
  private apiAvailable: boolean | null = null;

  private async hasApi(): Promise<boolean> {
    if (this.apiAvailable !== null) return this.apiAvailable;
    const token = await getMediaUserToken();
    this.apiAvailable = !!token;
    return this.apiAvailable;
  }

  // Playback always goes through native
  play(query?: string) { return this.native.play(query); }
  pause() { return this.native.pause(); }
  resume() { return this.native.resume(); }
  next() { return this.native.next(); }
  previous() { return this.native.previous(); }
  seek(seconds: number) { return this.native.seek(seconds); }
  setVolume(level: number) { return this.native.setVolume(level); }
  getVolume() { return this.native.getVolume(); }
  getStatus() { return this.native.getStatus(); }
  getDevices() { return this.native.getDevices(); }
  addToQueue(trackId: string) { return this.native.addToQueue(trackId); }
  addToPlaylist(playlistId: string, trackIds: string[]) { return this.native.addToPlaylist(playlistId, trackIds); }
  removeFromPlaylist(playlistId: string, trackIds: string[]) { return this.native.removeFromPlaylist(playlistId, trackIds); }
  getPlaylistInfo(playlistId: string) { return this.native.getPlaylistInfo(playlistId); }

  // Search: prefer API (full catalog) if available, fall back to native (library only)
  async search(query: string, types: SearchType[], limit?: number): Promise<SearchResults> {
    if (await this.hasApi()) {
      try {
        return await this.api.search(query, types, limit);
      } catch {
        // API failed — fall back to native
        return this.native.search(query, types, limit);
      }
    }
    return this.native.search(query, types, limit);
  }

  // Library: prefer API if available (richer metadata), fall back to native
  async getPlaylists(): Promise<Playlist[]> {
    if (await this.hasApi()) {
      try { return await this.api.getPlaylists(); } catch { /* fall through */ }
    }
    return this.native.getPlaylists();
  }

  async getPlaylistTracks(playlistId: string): Promise<Track[]> {
    if (await this.hasApi()) {
      try { return await this.api.getPlaylistTracks(playlistId); } catch { /* fall through */ }
    }
    return this.native.getPlaylistTracks(playlistId);
  }

  async getLibraryTracks(limit?: number, offset?: number): Promise<Track[]> {
    if (await this.hasApi()) {
      try { return await this.api.getLibraryTracks(limit, offset); } catch { /* fall through */ }
    }
    return this.native.getLibraryTracks(limit, offset);
  }

  async getLibraryAlbums(limit?: number, offset?: number): Promise<Album[]> {
    if (await this.hasApi()) {
      try { return await this.api.getLibraryAlbums(limit, offset); } catch { /* fall through */ }
    }
    return this.native.getLibraryAlbums(limit, offset);
  }
}
