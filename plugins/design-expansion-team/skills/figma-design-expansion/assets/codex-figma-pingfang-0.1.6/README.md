# Codex Figma PingFang

Local bridge for designers who use Codex to generate both web pages and Figma drafts.

The important constraint: `PingFang SC` is a macOS system font. Remote Figma MCP servers do not reliably have access to it. This bridge renders Figma nodes inside Figma Desktop, so `figma.loadFontAsync({ family: "PingFang SC", style: "Semibold" })` can succeed on each designer's Mac.

## What This MVP Does

- Exposes a local MCP server at `http://127.0.0.1:3957/mcp`.
- Adds MCP tools for creating PingFang text and updating existing text nodes: `generate_pingfang_design`, `replace_pingfang_text`, `apply_pingfang_font`, `debug_current_page`, and `set_current_page`.
- Keeps a Figma development plugin open as the local renderer.
- Creates `frame`, `rectangle`, and `text` nodes in the current Figma Desktop file.
- Forces every text node to use `PingFang SC` according to `config/font.json`.
- For state-expansion work, updates existing Figma text nodes through the plugin instead of using temporary overlay text.

## 0.1.1 Stability Notes

- `npm run ensure` now requires a real PingFang font probe, not just an open port.
- The Figma plugin uses `http://localhost:3957` only. Do not change the manifest domain to `127.0.0.1`.
- Stale listeners on port `3957` are cleaned up before launch.
- Expired probe/render jobs are removed from the queue so old jobs are not executed after a retry.
- MCP sessions are recovered when Codex reconnects with an existing session header.
- Text input accepts both `text` and `content`, and font weight accepts `regular`, `medium`, `semibold`, `500`, or `600`.
- `npm run ensure` also verifies the loaded Figma plugin code supports current-page debugging. If `/probe` succeeds but `/debug-current-page` or `/replace-text` hangs, re-import `figma-plugin/manifest.json` from this package.

## Intended Teammate Workflow

Prefer sending the whole zip to Codex and asking Codex to read `CODEX-INSTALL-GUIDE.zh-CN.md`.

Teammates should only do the Figma-side install manually:

1. Unzip the package to a stable folder.
2. Open Figma Desktop.
3. Import `figma-plugin/manifest.json` from `Plugins -> Development -> Import plugin from manifest...`.
4. Tell Codex that the plugin is imported and ask Codex to run setup/ensure automatically before generating.

Codex should run the remaining commands:

```bash
npm run setup
FIGMA_URL="https://www.figma.com/design/..." npm run ensure
```

Do not ask teammates to run terminal commands unless Codex cannot access their local folder or macOS explicitly requires a permission approval.

Recommended prompt for teammates:

```txt
This is the Codex PingFang Bridge package. Please read CODEX-INSTALL-GUIDE.zh-CN.md and guide me through installation. Except for importing the Figma plugin, approving macOS permissions, or restarting Codex, complete the setup/ensure/generation steps automatically.
```

## Manual Install

```bash
cd codex-figma-pingfang
npm install
```

There are no runtime dependencies in the MVP, but running `npm install` creates a normal project install state for teammates.

## Start The Local MCP Server

```bash
npm run dev
```

Health check:

```bash
curl http://127.0.0.1:3957/health
curl http://127.0.0.1:3957/probe
curl http://127.0.0.1:3957/debug-current-page
```

## Daily One-Command Launch

After the plugin has been imported once, use:

```bash
npm run launch
```

This command:

- opens the target Figma file when `FIGMA_URL` is provided
- starts the local MCP bridge if it is not already running
- compiles the macOS helper if needed
- opens `Plugins -> Development -> Codex PingFang Bridge` in Figma
- confirms the local bridge is reachable

macOS may ask for Accessibility permission. Allow the terminal app or launcher used by the teammate.

## Self-Healing Check

For Codex-driven workflows, use:

```bash
FIGMA_URL="https://www.figma.com/design/..." npm run ensure
```

This opens the requested Figma file, then checks whether the local bridge is reachable and whether Figma is connected to it. If not, it runs `npm run launch`.

Ready means all of these are true:

- `/probe` returns `ok:true`.
- `/probe` has an empty `missingPluginCapabilities` array.
- `/debug-current-page` returns `ok:true`.
- Existing text replacement through `/replace-text` does not time out.

Suggested Codex prompt:

```txt
I have already imported the Codex PingFang Bridge plugin in Figma Desktop. Before generating a Figma design, find my codex-figma-pingfang folder, run npm run setup, then extract the Figma URL from my request and run FIGMA_URL="<that URL>" npm run ensure. If it starts the bridge, keep it running, then continue generating the design with figma_pingfang. Do not ask me to run terminal commands unless macOS requires a permission click.
```

## Install The Figma Plugin

Do this once per teammate:

1. Open Figma Desktop.
2. Go to `Plugins -> Development -> Import plugin from manifest...`.
3. Select `figma-plugin/manifest.json`.
4. Run `Plugins -> Development -> Codex PingFang Bridge`.
5. Keep the small plugin window open while Codex generates Figma designs.

This is not a per-generation cleanup click. It is the bridge process that lets Codex render through the local Figma Desktop environment.

If Figma asks for local network access, allow access to `localhost:3957`.

## Open The Plugin With Desktop Automation

After importing the plugin once, you can open it with:

```bash
npm run open-plugin
```

This uses macOS UI scripting to click:

```txt
Plugins -> Development -> Codex PingFang Bridge
```

macOS may ask for Accessibility permission. Allow the terminal app you use to run the command, or allow Codex if Codex runs it directly.

## Codex Config

Run:

```bash
npm run setup
```

This installs the MCP config into `~/.codex/config.toml` and builds the macOS helper.

Equivalent manual config:

```toml
[mcp_servers.figma_pingfang]
type = "http"
url = "http://127.0.0.1:3957/mcp"
```

Restart Codex after editing the config.

## Design JSON Shape

```json
{
  "clearPage": false,
  "document": {
    "type": "frame",
    "name": "AI发品设计稿",
    "width": 294,
    "height": 101,
    "fill": "#ffffff",
    "layout": "horizontal",
    "gap": 16,
    "children": [
      {
        "type": "text",
        "text": "ai发品设计稿",
        "fontSize": 20,
        "fontWeight": "semibold",
        "fill": "#000000"
      }
    ]
  }
}
```

Supported node types:

- `frame`
- `rectangle`
- `text`

Supported text weights:

- `regular`
- `medium`
- `semibold`

Edit `config/font.json` if a teammate needs a different local font.

## Web Page Font Rule

For generated web pages, use this font stack:

```css
:root {
  --font-sans: "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Sans SC", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
}

html,
body,
button,
input,
textarea,
select {
  font-family: var(--font-sans);
}
```

Do not use Figma export strings like `PingFang_SC:Semibold` in CSS.

## MVP Limitations

- The Figma plugin must be open while generating. Figma does not allow arbitrary external processes to write the canvas without a plugin/runtime in the editor.
- The first version supports basic layout and text. It does not yet support gradients, images, component instances, variables, or design-system imports.
- If `PingFang SC Semibold` fails to load on a teammate's machine, that teammate's Figma Desktop cannot see the local font. Confirm they are on macOS and Figma Desktop, not browser Figma.
- Do not confuse this Figma development plugin with `Figma Bridge Helper.app`. This package uses the Figma plugin named `Codex PingFang Bridge` plus the local `localhost:3957` server.

## Pack A Release Zip

```bash
npm run doctor
npm run pack:zip
```

The zip is written next to this folder, for example:

```txt
../codex-figma-pingfang-0.1.6.zip
```
