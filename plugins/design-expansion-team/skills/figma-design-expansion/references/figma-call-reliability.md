# Figma Call Reliability

Use this contract for every Figma mutation performed by this skill, especially when the local Codex PingFang Bridge participates in text writing.

## Contents

- Responsibility boundaries
- Strict readiness gate
- Page and node context
- Font handling
- Staged execution
- Failure recovery
- Layout dependency updates
- Dual validation
- Completion checklist

## Responsibility Boundaries

Keep three responsibilities separate:

- The expansion skill decides business states, field mappings, source nodes, variants, placement, and layout changes.
- Official Figma MCP inspects the real document structure and validates nodes, instances, styles, and rendered results.
- The local PingFang Bridge transports and executes supported Figma mutations where editable PingFang text is required.

The Bridge is not a design-decision engine. Do not change Bridge code to compensate for wrong copy mapping, button composition, spacing, height, semantic color, component choice, or output placement. Fix those errors in the modification manifest or Figma payload.

## Strict Readiness Gate

Before each write batch, verify all five layers in order:

1. The expected local listener is running on the configured port.
2. The service health endpoint responds successfully.
3. The plugin probe succeeds and `missingPluginCapabilities` is empty.
4. The current-file/page inspection returns the requested Figma file and page.
5. The exact source and destination node IDs resolve under that page.

A visible `Connected` label proves only that some connection exists. It does not prove the correct plugin version, capabilities, file, page, selection, or target node.

Treat startup and plugin attachment as separate lifecycle events. A setup or `ensure` command can return successfully while the process later exits, an older listener remains, or the plugin reconnects to a different page. Re-run the strict gate immediately before every batch, not only at task start.

When supported, run an empty replacement smoke test before the first real text write. It must succeed without changing the document.

## Page and Node Context

Every Figma execution must establish its own context:

1. Resolve the requested page.
2. Set it as the current page.
3. Resolve the stable source parent and target nodes.
4. Perform only the bounded mutation for that stage.
5. Return the created or mutated node IDs.

Do not rely on the previous call's page, selection, viewport, or cached node objects. If a node ID becomes stale, rediscover it from a stable named parent and verify its hierarchy, component identity, and visible copy before continuing.

Compute placement from the requested source node's absolute bounds. Never place output relative to the viewport, current selection, or arbitrary empty canvas space.

## Font Handling

Never infer the target font from the first text node in a subtree. The first node may use an icon or special-purpose font such as `Faxian Font Heavy12.12`.

Resolve fonts from semantically matching source nodes, such as `主标题`, `日期`, `文案记录`, status text, or button labels. Preserve the source node's actual family, style, text-style binding, and mixed-style ranges.

Before changing characters, appending rows, moving text-bearing clones, or replacing rich text:

1. Inspect every text node in the affected subtree.
2. Collect all actual font families and styles, including mixed ranges.
3. Load every required font.
4. Stop if a required editable font is unavailable.

Do not silently substitute Noto, another system font, a detached text layer, or an approximate component. Restore the required font/tool path or report the exact blocker.

## Token-Preserving Text Mutation

Treat text content and text styling as separate contracts. A state expansion normally changes content, not the design-system inheritance chain.

Before changing a text node, capture or resolve from the exact corresponding source text node:

- `textStyleId`
- font family/style and mixed font ranges
- bound font-size, line-height, and font-weight variables
- bound fill/color variables and non-solid auxiliary paints
- existing explicit highlight ranges
- containing instance and `mainComponentId`

Then mutate in this order:

1. Load every required source font without assigning a new `fontName` override.
2. Replace `characters` only.
3. Restore the source/previous `textStyleId` and bound paints/variables.
4. Reset ordinary ranges to the token-bound source fill.
5. Apply only the mapping's exact literal highlight ranges as local rich-text overrides.
6. Leave component ancestry, typography dimensions, and layout properties unchanged unless the manifest explicitly controls them.

Never make text writable by assigning local `fontName`, font size, weight, line height, or hexadecimal fills. That can leave an instance visually correct while breaking the Typography and Fill token links.

For historical-output audits, identify a broken node when the corresponding main-component text has a non-empty style/token but the generated descendant has an empty `textStyleId`, missing bound variables, or local fills. Repair it in place from the source text node while preserving current characters and red/highlight segments. After repair, verify both:

- every audited instance still resolves to its original `mainComponentId`;
- no source-styled descendant remains without the expected style and variable bindings.

## Staged Execution

Do not combine deletion, cloning, copy replacement, variant switching, layout recomputation, and validation into one giant script.

Use this sequence:

1. **Inspect**: identify the source page, review unit, components, variants, text nodes, styles, fonts, and absolute bounds.
2. **Build manifest**: record each state as exact node operations: clone, replace text, apply highlight, switch variant, toggle visibility, reorder action, resize dependent container, and place output.
3. **Create skeleton**: clone the complete baseline or required review unit and place it beside the source. Return new frame IDs.
4. **Validate skeleton**: confirm file, page, parent, position, complete-page structure, component identity, and fixed modules.
5. **Write content**: update only manifest-controlled fields after loading fonts. Return mutated text and instance IDs.
6. **Validate styles**: check font family/style, `textStyleId`, fill/style bindings, exact rich-text ranges, and component ancestry.
7. **Recompute layout**: update dependent bounds from inner content outward.
8. **Render and inspect**: capture the generated states and compare them with the mapping and source design.

For large state sets, process small batches. A successful stage becomes the recovery checkpoint for the next stage.

## Failure Recovery

On any call failure:

1. Stop issuing mutations.
2. Inspect the current file, page, target parents, created IDs, and partial outputs.
3. Classify the failure as connection/capability, stale context, font, payload, unsupported component, or design/layout.
4. Repair only the failed dependency or stage.
5. Resume from the first unfinished stage.

Never blindly retry the same large script. Never delete and regenerate correct outputs merely because a later stage failed. Never describe a design execution error as a Bridge error.

Use these ownership rules:

- Connection, missing plugin capability, or transport timeout -> restore service/plugin readiness.
- Wrong page, stale node, or misplaced output -> repair execution context and placement calculation.
- Font load or mixed-style failure -> resolve and load the exact source fonts.
- Wrong copy, highlight, button set, component, color, or visibility -> repair the mapping manifest or payload.
- Clipping, overlap, spacing, or height mismatch -> repair the dependent layout chain.

## Layout Dependency Updates

Treat layout as a dependency graph. Any change to text length, line count, row spacing, proof count, module visibility, button composition, or child count can invalidate ancestor bounds.

Recompute from inside out:

`text/child bounds -> content container -> card/module -> row -> section -> complete page`

Preserve single-line and ellipsis contracts when the source field forbids wrapping. Do not solve overflow by changing unrelated typography, width, or component geometry.

## Dual Validation

Completion requires both structural and visual validation.

Structural validation must verify:

- Requested Figma file and page.
- Generated frame names, parent, absolute position, and source adjacency.
- Expected fixed modules and state-dependent visibility.
- Exact component instance and `mainComponentId` where applicable.
- Font family/style and text-style bindings.
- Bound typography variables, bound fill variables, and exact highlighted substrings.
- Ordered buttons, hidden actions, and overflow ownership.
- No legacy copy or unresolved placeholders.

Visual validation must verify:

- No clipping, overlap, accidental wrapping, duplicate overlays, or empty bars.
- Correct spacing, card height, row height, and section height after content changes.
- Correct semantic status color and button hierarchy.
- Complete-page output when the user requested pages.
- Output is visibly beside the requested source design.

A tool success response, returned node ID, or `Connected` window is evidence of execution only. It is not evidence of a correct design.

## Completion Checklist

Do not report completion until all answers are yes:

- Did the strict readiness gate pass immediately before the write batch?
- Did every call set and verify its page context?
- Did each output originate from the closest complete baseline?
- Did all mutations follow the internal mapping manifest?
- Were required PingFang and mixed-range fonts loaded without substitution?
- Did copy-only writes preserve source `textStyleId`, typography variables, fill variables, and instance ancestry?
- Were operations staged with recoverable node-ID checkpoints?
- Were dependent bounds recomputed after content or visibility changes?
- Did structural validation pass?
- Did rendered visual validation pass?
- Are generated frames beside the exact requested source node?
