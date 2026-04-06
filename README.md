# Aria

Apple Music CLI for power users and AI agents.

Like [Spogo](https://github.com/steipete/spogo) for Spotify, but for Apple Music. Control playback, search the catalog, manage your library -- all from the terminal with JSON output for automation.

## Architecture

Three engine modes:

| Engine | What it does | Auth needed |
|--------|-------------|-------------|
| **Native** | Controls Music.app via JXA (JavaScript for Automation). Playback, library, playlists, shuffle, repeat, AirPlay. | None |
| **API** | Queries Apple Music catalog and library via `amp-api.music.apple.com`. 100M+ tracks. | Apple Music web token |
| **Auto** (default) | Native for playback, API for catalog/library when authenticated. Error propagates on API failure -- no silent fallback. | Optional |

The native engine works out of the box on macOS -- no API keys, no rate limits, no auth. The API engine adds full catalog search and richer library metadata using your browser's `media-user-token`. Tokens are stored in the macOS Keychain.

## Install

```bash
git clone https://github.com/proxynico/aria.git
cd aria
bun install
bun link
```

### Build single binary

```bash
bun run build
# Creates ./dist/aria
```

## Quick Start

```bash
# Check what's playing
aria status

# Play / pause / skip
aria play
aria pause
aria next
aria prev

# Search your library (or full catalog with API auth)
aria search track "radiohead"
aria search album "ok computer"
aria search artist "beatles"

# Volume
aria volume        # get current
aria volume 60     # set to 60

# Shuffle and repeat
aria shuffle on
aria repeat all

# Playlists
aria library playlists
aria library playlist <id>
aria playlist info <id>

# Defaults
aria config status
aria config engine auto
aria config storefront auto
```

## Output Modes

Every command supports three output modes:

```bash
# Human-readable (default) -- colorized, formatted
aria status

# JSON -- machine-readable, stable schema
aria status --json

# Plain -- tab-separated, pipe-friendly
aria status --plain
```

The `--json` flag makes Aria agent-friendly. AI agents can parse structured output without scraping terminal formatting.

## Entity IDs

All entities (tracks, albums, artists, playlists) carry source-qualified IDs:

| Format | Meaning |
|--------|---------|
| `native:persistent:ABC123` | Music.app persistent ID |
| `api:library:l.ABC123` | Apple Music library ID |
| `api:catalog:1234567` | Apple Music catalog ID |
| `native:derived:album:...` | Derived from track search (no direct ID) |

JSON output includes `id`, `source`, and explicit `persistentId`, `libraryId`, `catalogId` fields when available. Native-only mutation commands (playlist add/remove) require native persistent IDs.

If Aria cannot perform an operation safely, it fails explicitly rather than doing something surprising.

## Apple Music API Setup (Optional)

The native engine handles playback without any setup. To unlock **full catalog search**, set up the API engine:

```bash
# Auto-import from Safari (easiest)
aria auth import --browser safari

# Or from Chrome/Firefox/Edge/Brave
aria auth import --browser chrome

# Or paste the token manually
aria auth token <paste-here>

# Check status
aria auth status
```

Tokens are stored in the macOS Keychain (`aria-music` service), not in config files.

## Engine Selection

```bash
# Auto (default): native for playback, API for catalog/library when available
aria search track "new song"

# Force native: library-only search, no network
aria --engine native search track "radiohead"

# Force API: catalog search (requires auth)
aria --engine api search track "new release"
```

Persistent defaults:

```bash
aria config engine auto
aria config storefront auto
```

## All Commands

```
Playback:    play [query] | pause | resume | next | prev | seek <s> | status
Volume:      volume [0-100]
Modes:       shuffle [on|off] | repeat [off|one|all]
Search:      search track|album|artist|playlist|all <query> [-l limit]
Library:     library tracks|albums|playlists | library playlist <id>
Playlists:   playlist info <id> | playlist add <id> <trackIds...> | playlist remove <id> <trackIds...>
Queue:       queue add <trackId>   (fails explicitly; reliable Music.app queueing not implemented)
Devices:     devices
Auth:        auth import|token|status|clear
Config:      config status | config engine [native|api|auto] | config storefront [code|auto]
```

## Global Flags

```
--json         JSON output
--plain        Tab-separated output
--no-color     Disable colors
--engine <e>   native | api | auto
-v, --verbose  Verbose output
```

## Requirements

- macOS (native engine uses Music.app via JXA)
- [Bun](https://bun.sh) runtime
- Music.app (comes with macOS)
- Apple Music subscription (for API catalog search)

## How It Works

**Native engine**: Executes JXA scripts via `osascript` to control Music.app directly. No network, no rate limits, instant response. Supports playback, library search, playlist management, shuffle, repeat, and AirPlay device listing. All user inputs are validated and safely interpolated via `JSON.stringify()`.

**API engine**: Uses the `media-user-token` from your browser (set when you log into music.apple.com) with Apple's `amp-api.music.apple.com` endpoints. The developer token is extracted from the web player's JS bundle with JWT validation and a 30-minute cache. Storefront is configurable and defaults to auto-discovery. API responses are parsed through type-safe extraction helpers.

**Auto engine**: Combines both. Playback always goes through native. Search and library queries use API when authentication exists, otherwise native. If API auth exists but a request fails, the error surfaces immediately -- Aria never silently changes which engine handles a request.

## Error Handling

Aria uses a structured error hierarchy with error codes and actionable hints:

- **ValidationError** -- invalid user input (bad integer, unknown engine, etc.)
- **AuthError** -- missing or expired Apple Music token
- **ExternalServiceError** -- Music.app not running, API failure, cookie extraction failure
- **UnsupportedOperationError** -- operation not available on the selected engine

All errors print to stderr with a colored message and optional hint line.

## Development

```bash
bun install
bun run typecheck               # tsc --noEmit
bun test                        # 34 tests across 7 files
bun run check                   # typecheck + test
bun run src/index.ts status     # run without building
```

## License

MIT
