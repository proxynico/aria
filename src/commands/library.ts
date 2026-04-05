import type { Command } from "commander";
import type { MusicEngine } from "../lib/types";
import { getOutputMode, outputTracks, outputAlbums, outputPlaylists, outputPlaylistDetails, outputJson, outputMessage } from "../lib/output";

export function registerLibraryCommands(program: Command, getEngine: () => MusicEngine) {
  const library = program.command("library").alias("lib").description("Browse your music library");

  library
    .command("tracks")
    .alias("songs")
    .description("List library tracks")
    .option("-l, --limit <n>", "Max results", "50")
    .option("-o, --offset <n>", "Offset", "0")
    .action(async (opts) => {
      const engine = getEngine();
      const tracks = await engine.getLibraryTracks(parseInt(opts.limit), parseInt(opts.offset));
      const mode = getOutputMode(program.opts());
      outputTracks(tracks, mode);
    });

  library
    .command("albums")
    .description("List library albums")
    .option("-l, --limit <n>", "Max results", "50")
    .option("-o, --offset <n>", "Offset", "0")
    .action(async (opts) => {
      const engine = getEngine();
      const albums = await engine.getLibraryAlbums(parseInt(opts.limit), parseInt(opts.offset));
      const mode = getOutputMode(program.opts());
      outputAlbums(albums, mode);
    });

  library
    .command("playlists")
    .description("List your playlists")
    .action(async () => {
      const engine = getEngine();
      const playlists = await engine.getPlaylists();
      const mode = getOutputMode(program.opts());
      outputPlaylists(playlists, mode);
    });

  library
    .command("playlist <id>")
    .description("Show tracks in a playlist")
    .action(async (id: string) => {
      const engine = getEngine();
      const tracks = await engine.getPlaylistTracks(id);
      const mode = getOutputMode(program.opts());
      outputTracks(tracks, mode);
    });

  // ── Playlist info (details, artwork, description, stats) ──

  const pl = program.command("playlist").alias("pl").description("Playlist management");

  pl
    .command("info <id>")
    .description("Show playlist details: description, artwork, top artists, genres")
    .action(async (id: string) => {
      const engine = getEngine();
      const details = await engine.getPlaylistInfo(id);
      const mode = getOutputMode(program.opts());
      outputPlaylistDetails(details, mode);
    });

  // ── Playlist editing ──

  pl
    .command("add <playlistId> <trackIds...>")
    .description("Add one or more tracks to a playlist by their persistent IDs")
    .action(async (playlistId: string, trackIds: string[]) => {
      const engine = getEngine();
      const mode = getOutputMode(program.opts());
      await engine.addToPlaylist(playlistId, trackIds);
      if (mode === "json") {
        outputJson({ action: "playlist_add", playlistId, trackIds, count: trackIds.length });
      } else if (mode !== "plain") {
        outputMessage(`Added ${trackIds.length} track${trackIds.length === 1 ? "" : "s"} to playlist`);
      }
    });

  pl
    .command("remove <playlistId> <trackIds...>")
    .alias("rm")
    .description("Remove one or more tracks from a playlist by their persistent IDs")
    .action(async (playlistId: string, trackIds: string[]) => {
      const engine = getEngine();
      const mode = getOutputMode(program.opts());
      await engine.removeFromPlaylist(playlistId, trackIds);
      if (mode === "json") {
        outputJson({ action: "playlist_remove", playlistId, trackIds, count: trackIds.length });
      } else if (mode !== "plain") {
        outputMessage(`Removed ${trackIds.length} track${trackIds.length === 1 ? "" : "s"} from playlist`);
      }
    });

  pl
    .command("tracks <id>")
    .description("List tracks in a playlist (alias for library playlist)")
    .action(async (id: string) => {
      const engine = getEngine();
      const tracks = await engine.getPlaylistTracks(id);
      const mode = getOutputMode(program.opts());
      outputTracks(tracks, mode);
    });

  pl
    .command("list")
    .alias("ls")
    .description("List all playlists")
    .action(async () => {
      const engine = getEngine();
      const playlists = await engine.getPlaylists();
      const mode = getOutputMode(program.opts());
      outputPlaylists(playlists, mode);
    });
}
