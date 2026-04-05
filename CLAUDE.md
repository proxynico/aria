# Aria

Apple Music CLI for power users and AI agents. Inspired by [Spogo](https://github.com/steipete/spogo) (Spotify CLI).

## Stack

- **Runtime:** Bun
- **Language:** TypeScript (strict mode)
- **CLI framework:** Commander.js
- **macOS integration:** JXA (JavaScript for Automation) via `osascript`
- **Apple Music API:** Cookie-based auth against `amp-api.music.apple.com`

## Architecture

Two engines behind one interface (`MusicEngine`):

| Engine | Purpose | Auth |
|--------|---------|------|
| **Native** (`engines/native.ts`) | Controls Music.app via JXA. Playback, library, playlists, AirPlay. No network. | None |
| **API** (`engines/api.ts`) | Full Apple Music catalog via internal web API. Search 100M+ tracks. | `media-user-token` cookie |
| **Auto** (`engines/auto.ts`) | Routes: native for playback, API for catalog search. Falls back gracefully. | Optional |

All engines implement `MusicEngine` (defined in `lib/types.ts`). The auto engine is the default.

## Project Structure

```
src/
  index.ts              Entry point. Commander setup, engine factory.
  engines/
    native.ts           Music.app control via JXA (osascript -l JavaScript)
    api.ts              amp-api.music.apple.com with cookie auth
    auto.ts             Smart routing between native and API
  commands/
    playback.ts         play, pause, resume, next, prev, seek, status, volume, shuffle, repeat
    search.ts           search track|album|artist|playlist|all
    library.ts          library tracks|albums|playlists + playlist info|add|remove
    auth.ts             auth import|token|status|clear
    devices.ts          AirPlay device listing
    queue.ts            Queue add
  lib/
    types.ts            All domain types + MusicEngine interface
    output.ts           JSON/plain/human output formatting
    config.ts           ~/.config/aria/config.json management
    cookies.ts          Browser cookie extraction (Safari, Chrome, Firefox, Edge, Brave)
```

## Key Conventions

- Every command supports three output modes: `--json`, `--plain` (tab-separated), default (colorized human)
- Errors go through `outputError()` (stderr, colorized). Never raw `console.error()`.
- JXA scripts run via the `jxa()` and `jxaJson<T>()` helpers in `native.ts`
- The API engine extracts Apple's developer token from the web player JS bundle at runtime
- Config lives at `~/.config/aria/config.json`
- Artwork exports to `/tmp/aria-artwork-{id}.png`

## Commands

```
Playback:    play [query] | pause | resume | next | prev | seek <s> | status
Volume:      volume [0-100]
Modes:       shuffle [on|off] | repeat [off|one|all]
Search:      search track|album|artist|playlist|all <query> [-l limit]
Library:     library tracks|albums|playlists | library playlist <id>
Playlists:   playlist info <id> | playlist add <id> <trackIds...> | playlist remove <id> <trackIds...>
Queue:       queue add <trackId>
Devices:     devices
Auth:        auth import|token|status|clear
```

## Development

```bash
bun install
bun run src/index.ts status     # run directly
bun link                        # link globally as `aria`
bun run build                   # compile to single binary
```

## Adding a New Command

1. Create handler in `src/commands/` following existing patterns
2. Accept `program: Command` and `getEngine: () => MusicEngine`
3. Handle all three output modes (`getOutputMode(program.opts())`)
4. Register in `src/index.ts`

## Adding to the MusicEngine Interface

1. Add method signature to `MusicEngine` in `lib/types.ts`
2. Implement in `native.ts` (JXA), `api.ts` (web API), and `auto.ts` (routing)
3. API engine can `throw new Error(...)` for operations it can't support
4. Auto engine delegates playback to native, data queries to API with native fallback
