# Aria

Apple Music CLI for power users and AI agents.

Like [Spogo](https://github.com/steipete/spogo) for Spotify, but for Apple Music. Control playback, search the catalog, manage your library — all from the terminal with JSON output for automation.

## Architecture

Two engines, best of both worlds:

| Engine | What it does | Auth needed |
|--------|-------------|-------------|
| **Native** | Controls Music.app via JXA (JavaScript for Automation) | None |
| **API** | Queries Apple Music catalog via `amp-api.music.apple.com` | Browser cookies |
| **Auto** (default) | Native for playback, API for catalog search | Optional |

The native engine works out of the box on macOS — no API keys, no rate limits, no auth. The API engine adds full Apple Music catalog search by using your browser's `media-user-token` cookie (the same approach Spogo uses with Spotify cookies).

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
# Creates ./aria binary
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

## Engine Selection

```bash
# Auto (default): native for playback, API for catalog when available
aria search track "new song"

# Force native: library-only search, no network
aria --engine native search track "radiohead"

# Force API: catalog search (requires auth)
aria --engine api search track "new release"
```

## All Commands

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

**API engine**: Extracts the `media-user-token` cookie from your browser (set when you log into music.apple.com) and uses it with Apple's internal `amp-api.music.apple.com` endpoints. The developer token is extracted from the Apple Music web player's JS bundle. This gives access to the full Apple Music catalog — 100M+ tracks — without needing an official MusicKit developer account.

**Auto engine**: Combines both. Playback always goes through native (it's local and instant). Search and library queries try API first (richer catalog data), falling back to native if API isn't configured or fails.

## License

MIT
