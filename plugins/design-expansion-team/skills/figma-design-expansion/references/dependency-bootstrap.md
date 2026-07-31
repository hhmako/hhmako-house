# Dependency Bootstrap Contract

Dependencies are preparation for the user's design task, never the final deliverable. Finish requirement understanding first, then bootstrap only the capability required by the next action.

## Hard requirements

- Never ask the user to install `lark-cli` manually when npm is available. Run `scripts/ensure_lark_cli.sh` and continue the original task.
- Never ask the user to separately download Codex PingFang Bridge. This skill bundles it under `assets/codex-figma-pingfang-0.1.6`; run `scripts/ensure_pingfang_bridge.sh`.
- Ask the user only for actions Codex cannot complete: Feishu browser authorization, Figma Desktop plugin import, or an operating-system permission dialog.
- Ask for one human action at a time, verify it, then resume from the interrupted stage. Do not restart PRD analysis or regenerate completed work.
- Do not silently fall back to a local table or approximate font. A fallback requires a concrete installation/authentication failure and explicit user awareness.

## Feishu/Lark capability

When the next action reads or writes a Feishu/Lark document or sheet:

1. Run `scripts/ensure_lark_cli.sh`.
2. The script uses an existing `lark-cli` when available. Otherwise it installs the official `@larksuite/cli` package into `$HOME/.codex/tools/lark-cli` without editing shell startup files.
3. Use the executable path printed by the script for all subsequent calls.
4. Check authentication outside a restricted sandbox when the platform keychain is unavailable.
5. If authentication is absent, start the CLI login flow and ask the user only to finish browser authorization. Verify access afterward.
6. Continue the original read/write operation.

If Node/npm is missing, or official package installation fails after a permitted retry, report the exact blocker. Do not claim that a live Sheet was created.

## PingFang Figma capability

When the next action writes to Figma or requires local PingFang font preservation:

1. Run `scripts/ensure_pingfang_bridge.sh --setup-only`.
2. The script copies the bundled Bridge to `$HOME/.codex/tools/codex-figma-pingfang-0.1.6`, verifies it, and installs its Codex MCP configuration.
3. If the Figma plugin has not been imported, give the user the manifest path printed by the script and ask them to import it once in Figma Desktop: `Plugins > Development > Import plugin from manifest`.
4. After the plugin is open in the correct Figma file, run `scripts/ensure_pingfang_bridge.sh --figma-url "<Figma URL>"`.
5. Apply the Bridge readiness and token-preservation checks in `figma-call-reliability.md`, then continue the original write.

Do not treat a connected Bridge as proof that the correct Figma file, page, node, component, or token is selected.

## Full package installation

When the user explicitly asks to install the complete Skill package, run `scripts/install_bundle_dependencies.sh`. This installs/configures both dependencies, but the user may still need to complete Feishu authorization and import/open the Figma plugin once.
