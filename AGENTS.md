# AI Agent Instructions for Platanus Hack 26: Arcade Challenge

You are helping build an arcade game for a hackathon challenge. Follow these instructions carefully.

## Your Goal

Create an engaging, fun arcade game in **game.js** using **Phaser 3** (v3.87.0) that meets all restrictions.

## ⚠️ IMPORTANT: Files to Edit

**ONLY edit these three files:**
- `game.js` - Your game code
- `metadata.json` - Game name, description, and player mode
- `cover.png` - Game cover image (800x600 pixels)

**DO NOT edit any other files** (including index.html, check-restrictions files, config files, etc.)

## Critical Restrictions

1. **Size**: Game must be ≤50KB after minification (before gzip)
2. **No imports**: Pure vanilla JavaScript only - no `import` or `require`
3. **No external URLs**: No `http://`, `https://`, or `//` (except `data:` URIs for base64)
4. **No network calls**: No `fetch`, `XMLHttpRequest`, or similar
5. **Sandboxed environment**: Game runs in iframe with no internet access

## What's Allowed

-  Base64-encoded images (as `data:` URIs)
-  Procedurally generated graphics using Phaser's Graphics API
-  Generated audio tones using Phaser's Web Audio API
-  Canvas-based rendering and effects

## Development Workflow

1. **Edit game.js**: Write your game code in this single file
2. **Update metadata.json**: Set `game_name`, `description`, and `player_mode` (`single_player` or `two_player`)
3. **Create cover.png**: Design an 800x600 pixel cover image for your game
4. **Check restrictions**: Run `npm run check-restrictions` frequently
5. **DO NOT start dev servers**: The user will handle running `npm run dev` - do not run it yourself

## Phaser 3 Resources

- **Quick start guide**: @docs/phaser-quick-start.md
- **API documentation**: For specific Phaser methods and examples, search within docs/phaser-api.md

## Size Optimization Tips

- Use short variable names before minification
- Avoid large data structures or arrays
- Generate graphics procedurally instead of embedding images
- Keep game logic simple and efficient
- Test size early and often with `npm run check-restrictions`

## Validation

Always validate your work:
```bash
npm run check-restrictions
```

This checks:
- File size after minification
- No forbidden imports
- No network calls
- No external URLs
- Code safety warnings

## Game Structure

`game.js` already contains a full working starter — two players moving around with sound and storage. Use it as your base. A copy is also in the README for reference.

## Controls

- Use the arcade codes (`P1_U`, `P1_1`, `START1`, etc.) in your game logic — never raw keyboard keys
- **Do NOT change or replace existing keys in `CABINET_KEYS`** — they map to the physical cabinet wiring. To add local testing shortcuts, append to the arrays (e.g. `P1_U: ['w', 'ArrowUp']`)
- Keep controls simple: joystick + 1–2 action buttons is the sweet spot for arcade feel

## Storage

Use `window.platanusArcadeStorage` for persistence (e.g. leaderboards):

```js
const result = await window.platanusArcadeStorage.get('my-key'); // { found, value }
await window.platanusArcadeStorage.set('my-key', { score: 100 });
await window.platanusArcadeStorage.remove('my-key');
```

- Storage persists across releases — always validate data you read back, the shape may have changed
- Keys: `[A-Za-z0-9._:/-]`, 1–128 chars; values: JSON-compatible, under 64 KiB

## cover.png

- Must be exactly **800×600 pixels**, PNG format, **500 KB or less**
- Generate it programmatically or draw it — just make it represent your game

## Important Notes

- Phaser is loaded externally via CDN (not counted in 50KB limit)
- Focus on gameplay and creativity within size constraints
- Use Phaser's built-in features (sprites, physics, tweens, etc.)
- Keep code readable - minification happens automatically

## Best Practices

1. **Start simple**: Get a working game first, optimize later
2. **Check size frequently**: Don't wait until the end
3. **Use Phaser features**: Leverage built-in physics, tweens, and effects
4. **Generate assets**: Draw shapes instead of using images when possible
5. **Let the user test**: The user will run `npm run dev` when they want to test - focus on building the game

Good luck building an amazing arcade game! <�

## Current Project State: HOOK

The repository is no longer the original brick-breaker starter. The implemented game is **HOOK**, a single-player arcade fishing game starring a stylized Colombian macaw. Treat the current files as the source of truth before making changes.

### Product Direction

- Game name: `HOOK`
- Player mode: `single_player`
- Theme: Colombian macaw fishing from a dock in a colorful ocean that becomes an abyss
- Core fantasy: descend, steer the hook, avoid hazards, catch rare fish, buy upgrades, and beat the depth/score record
- Text language: Spanish
- Visual identity: yellow, blue, and red Colombian palette over Caribbean water and deep-ocean navy
- The macaw is the primary visual identity and must remain recognizable at small scale

### Current Game Loop

The game uses one Phaser scene and these phases:

```text
menu -> dock -> cast -> sink -> bite -> mg -> caught/fail -> dock
                         |                         |
                         +-> line cut/reel --------+
                         dock -> shop
                         final cast -> gameover -> initials -> menu
```

- Each run has 5 launches.
- `P1_1` launches from the dock and taps/impulses the minigame indicator.
- During `sink`, the joystick steers the hook horizontally while depth increases automatically.
- Fish spawn in depth bands and touching one starts the bite sequence.
- The vertical minigame uses short `P1_1` taps to push the player indicator upward against gravity. Keep it overlapping the moving fish to fill progress; separation fills the escape meter.
- A successful catch awards the fish value as coins.
- The shop has three upgrades, each with three levels: `LÍNEA PROFUNDA`, `CEBO DE LUJO`, and `MANOS FRÍAS`.
- At 150m+, crabs attach to the line. Move left/right to accumulate shake distance and remove them before the timer expires.
- At 300m+, jellyfish can touch the hook and instantly break the line.
- Reaching the current maximum depth without a bite reels back with `SIN PICADA`.
- The two legendary species are deep, valuable, glow, trigger a flash/particle/camera-shake celebration, and increment the persistent legendary record.

### Current Rendering And Animation

- Graphics are procedural. No image assets are loaded by `game.js`.
- Small textures are generated once with Phaser Graphics, while the macaw and environment use Phaser primitives and containers.
- The surface has a sky gradient, sun halo, clouds, island silhouettes, dock, Colombian flag, animated waves, and sun reflections.
- The water uses a depth gradient, dark overlay, light rays, bubbles, and marine snow.
- The macaw container has head, face patch, beak, eye, crest, body, belly, wings, tail feathers, legs, rod, and hook line.
- Macaw poses are `IDLE`, `CAST`, `FISHING`, `BITE`, `CATCH`, `FAIL`, `BUY`, and `VICTORY`.
- Idle animation includes breathing, blinking, tail movement, wing motion, and head tracking toward the hook.
- The fishing line is drawn as a manually sampled quadratic Bezier approximation. Do not call Canvas-only `quadraticCurveTo` on Phaser Graphics; Phaser Graphics does not provide that method.
- `cover.png` is a custom 800x600 PNG with the macaw, dock, ocean, hook, fish, Colombian flag, and HOOK branding. It is currently about 65 KB.

### Important Code Locations

- Constants, species table, upgrades, cabinet mapping, and Phaser config are at the top of `game.js`.
- Input normalization and arcade held/pressed helpers are near the top of `game.js`.
- Procedural textures: `buildTextures`.
- Environment: `buildBackground`, `buildWater`, `waterTick`, and `buildDock`.
- Macaw construction and animation: `buildMacaw`, `macawState`, `macawTick`.
- Hook and line: `buildLine`, `lineDraw`, `hookTick`.
- Fishing gameplay: `startCast`, `castUpdate`, `sinkUpdate`, `startBite`, `reelUp`, `lineCut`, and `endCast`.
- Fish and hazards: `spawnFish`, `updateFishes`, `spawnJelly`, `updateJellies`, and `crabOff`.
- Catch minigame: `buildMinigameUi`, `mgStart`, `mgUpdate`, `mgHide`, `caughtCatch`, and `failCatch`.
- Shop: `buildShop`, `shopOpen`, `shopUpdate`, and `shopRefresh`.
- Menus and score entry: `buildMenu`, `buildGameOver`, `overShow`, `overUpdate`, and `updateEntryLetters`.
- Audio: `ensureAudio`, `tone`, `sfx`, and `startMusic`.
- Persistence: `hook-26-scores` and `hook-26-records`, accessed through the arcade storage bridge with localStorage fallback.

### Controls And Testing

The physical cabinet mapping in `CABINET_KEYS` must not be replaced. Local keyboard defaults are:

- `W/A/S/D`: Player 1 joystick
- `U`: Player 1 Button 1, launch/tap/confirm
- `I`: Player 1 Button 2, shop/exit
- `Enter`: `START1`, start/pause/continue
- Arrow keys and `R/T`: Player 2 equivalents are retained for cabinet compatibility, although this game is single-player

Use arcade codes in gameplay logic, never raw key strings. The current game was tested in a real Chromium-based browser with the flow menu -> dock -> cast -> sink, steering, fish spawning, bite, minigame, legendary catch, shop purchase, gameover, initials entry, and score save. Keep testing in a browser after gameplay changes.

### Validation Results And Commands

Run these from the repository root:

```bash
node --check game.js
npm run check-restrictions
```

The last successful restriction check reported approximately 38 KB minified, under the 50 KB limit, with no imports, network calls, external URLs, or suspicious code patterns.

The development server is normally:

```bash
npm run dev
```

It serves `http://localhost:3001/`. Do not start it automatically unless the user explicitly asks. The user may request the server to be run.

### Submit v1 Requirements

The dev UI Submit flow inspects only `game.js`, `metadata.json`, and `cover.png`, then creates a release commit/tag and pushes to `origin`.

Required before Submit v1:

- `origin` must point to the GitHub repository.
- Work must be on a named branch, currently `main`.
- `game.js`, `metadata.json`, and `cover.png` must be committed and pushed.
- `cover.png` must be a changed custom PNG, exactly 800x600, and at most 500 KB.
- The current custom cover passes these checks.
- The release API requires network access during submission; this does not violate the game's runtime restriction because it is the dev UI submission process, not game code.
- Do not press Submit repeatedly; one submission creates a release tag and pushes it.

#### Windows Default-Cover Warning

The installed `@platanus/arcade-dev-ui-26` cover checker finds the original cover with:

```text
git log --diff-filter=A --format=%H -- cover.png | tail -1
```

On Windows, `tail.exe` may not be on the child-process PATH. In that case the checker incorrectly reports `Default cover detected` even when the cover hash changed. Git for Windows includes the needed executable at `C:\Program Files\Git\usr\bin\tail.exe`.

Start the dev UI with that directory prepended to PATH when the warning appears:

```powershell
$env:Path = "C:\Program Files\Git\usr\bin;$env:Path"
npm run dev
```

Then hard-refresh the dev UI with `Ctrl+F5`. The cover checker should report `Custom cover provided`. Do not change the checker package or repository config to work around this warning.

### Repository Safety

- Keep the runtime implementation in `game.js`; do not add imports, external assets, fetches, or network code.
- Preserve the exact cabinet keys.
- Do not replace the current HOOK design with the old brick-breaker concept.
- Do not add large embedded assets; use procedural primitives and generated textures.
- Before commits, inspect `git status`, `git diff`, and the staged file list. Stage only intended files.
- The project instructions originally restrict edits to `game.js`, `metadata.json`, and `cover.png`; follow that restriction for implementation work. `AGENTS.md` was expanded once to preserve this handoff context.
