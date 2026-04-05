import type { Command } from "commander";
import type { MusicEngine, SearchType } from "../lib/types";
import {
  getOutputMode,
  outputTracks,
  outputAlbums,
  outputArtists,
  outputPlaylists,
  outputSearchResults,
} from "../lib/output";

export function registerSearchCommands(program: Command, getEngine: () => MusicEngine) {
  const search = program
    .command("search")
    .description("Search Apple Music");

  search
    .command("track <query>")
    .alias("song")
    .description("Search for tracks")
    .option("-l, --limit <n>", "Max results", "20")
    .action(async (query: string, opts) => {
      const engine = getEngine();
      const results = await engine.search(query, ["track"], parseInt(opts.limit));
      const mode = getOutputMode(program.opts());
      outputTracks(results.tracks, mode);
    });

  search
    .command("album <query>")
    .description("Search for albums")
    .option("-l, --limit <n>", "Max results", "20")
    .action(async (query: string, opts) => {
      const engine = getEngine();
      const results = await engine.search(query, ["album"], parseInt(opts.limit));
      const mode = getOutputMode(program.opts());
      outputAlbums(results.albums, mode);
    });

  search
    .command("artist <query>")
    .description("Search for artists")
    .option("-l, --limit <n>", "Max results", "20")
    .action(async (query: string, opts) => {
      const engine = getEngine();
      const results = await engine.search(query, ["artist"], parseInt(opts.limit));
      const mode = getOutputMode(program.opts());
      outputArtists(results.artists, mode);
    });

  search
    .command("playlist <query>")
    .description("Search for playlists")
    .option("-l, --limit <n>", "Max results", "20")
    .action(async (query: string, opts) => {
      const engine = getEngine();
      const results = await engine.search(query, ["playlist"], parseInt(opts.limit));
      const mode = getOutputMode(program.opts());
      outputPlaylists(results.playlists, mode);
    });

  search
    .command("all <query>")
    .description("Search across all types")
    .option("-l, --limit <n>", "Max results per type", "10")
    .action(async (query: string, opts) => {
      const engine = getEngine();
      const types: SearchType[] = ["track", "album", "artist", "playlist"];
      const results = await engine.search(query, types, parseInt(opts.limit));
      const mode = getOutputMode(program.opts());
      outputSearchResults(results, mode);
    });
}
