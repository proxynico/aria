import { describe, expect, test } from "bun:test";
import { deriveAlbumsFromTracks, deriveArtistsFromTracks } from "../src/engines/native";
import type { Track } from "../src/lib/types";

const tracks: Track[] = [
  {
    id: "native:persistent:1",
    source: "native",
    persistentId: "1",
    name: "Airbag",
    artist: "Radiohead",
    album: "OK Computer",
    duration: 276,
    genre: "Alternative",
    year: 1997,
  },
  {
    id: "native:persistent:2",
    source: "native",
    persistentId: "2",
    name: "Paranoid Android",
    artist: "Radiohead",
    album: "OK Computer",
    duration: 390,
    genre: "Alternative",
    year: 1997,
  },
  {
    id: "native:persistent:3",
    source: "native",
    persistentId: "3",
    name: "Everything in Its Right Place",
    artist: "Radiohead",
    album: "Kid A",
    duration: 251,
    genre: "Alternative",
    year: 2000,
  },
];

describe("native derived entities", () => {
  test("derives unique albums from track results", () => {
    const albums = deriveAlbumsFromTracks(tracks, 10);
    expect(albums).toHaveLength(2);
    expect(albums[0].id).toBe("native:derived:album:OK Computer::Radiohead");
  });

  test("derives unique artists from track results", () => {
    const artists = deriveArtistsFromTracks(tracks, 10);
    expect(artists).toHaveLength(1);
    expect(artists[0].id).toBe("native:derived:artist:Radiohead");
  });
});
