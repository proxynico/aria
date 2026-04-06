# Aria

Apple Music CLI for power users and AI agents.

Like [Spogo](https://github.com/steipete/spogo) for Spotify, but for Apple Music. Control playback, search the catalog, manage your library — all from the terminal with JSON output for automation.

## Architecture

Three engine modes:

| Engine | What it does | Auth needed |
|--------|-------------|-------------|
| **Native** | Controls Music.app via JXA (JavaScript for Automation) | None |
| **API** | Queries Apple Music catalog and library via `amp-api.music.apple.com` | Apple Music web token |
| **Auto** (default) | Native for playback, API for catalog and library when configured | Optional |

The native engine works out of the box on macOS — no API keys, no rate limits, no auth. The API engine adds full Apple Music catalog search and richer library reads by using your browser's `media-user-token`. `auto` now fails explicitly when configured API auth is broken instead of silently switching semantics.

## Install

```bash
# Clone and link
git clone https://github.com/nicmontero/aria.git
cd aria
bun install
bun link

# Or run directly
bun run src/index.ts status
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

# Search your library
aria search track "radiohead"
aria search album "ok computer"
aria search artist "beatles"

# Volume
aria volume        # get current
aria volume 60     # set to 60

# Defaults
aria config status
aria config engine auto
aria config storefront auto

# Playlists
aria library playlists
aria library playlist <id>

# Shuffle and repeat
aria shuffle on
aria repeat all
```

## Output Modes

Every command supports three output modes:

```bash
# Human-readable (default) — colorized, formatted
aria status

# JSON — machine-readable, stable schema
aria status --json

# Plain — tab-separated, pipe-friendly
aria status --plain
```

The `--json` flag makes Aria agent-friendly. AI agents can parse structured output without scraping terminal formatting.

## Command Contract

- `id` is a source-qualified reference such as `native:persistent:...`, `api:library:...`, or `api:catalog:...`
- JSON output also includes `source`, plus explicit `persistentId`, `libraryId`, and `catalogId` fields when available
- Native-only mutation commands require native persistent IDs
- `auto` uses native for playback and API for richer reads when authentication exists

If Aria cannot perform an operation safely, it fails explicitly rather than doing something surprising.

## Apple Music API Setup (Optional)

The native engine handles playback without any setup. To unlock **full catalog search** (not just your library), set up the API engine:

```bash
# Auto-import from Safari (easiest)
aria auth import --browser safari

# Or from Chrome/Firefox/Edge/Brave
aria auth import --browser chrome

# Or paste the token manually
# 1. Open music.apple.com, log in
# 2. DevTools > Application/Storage > Cookies
# 3. Copy the "media-user-token" value
aria auth token <paste-here>

# Check status
aria auth status
```

Imported or pasted tokens are stored in the macOS Keychain, not in `~/.config/aria/config.json`.

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
Queue:       queue add <trackId>   (currently fails explicitly; reliable Music.app queueing is not implemented)
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

**Native engine**: Executes JavaScript for Automation (JXA) scripts via `osascript` to control Music.app directly. No network, no rate limits, instant response. Supports full playback control, library search, playlist management, and AirPlay device listing.

**API engine**: Extracts the `media-user-token` cookie from your browser (set when you log into music.apple.com) and uses it with Apple's internal `amp-api.music.apple.com` endpoints. The developer token is extracted from the Apple Music web player's JS bundle. Storefront is configurable and defaults to auto-discovery from the authenticated account.

**Auto engine**: Combines both. Playback always goes through native. Search and library queries use API when authentication exists, otherwise native. If API auth exists but the request fails, Aria surfaces the error instead of quietly changing behavior.

## Development

```bash
bun run typecheck
bun test
bun run check
```

## License

MIT
