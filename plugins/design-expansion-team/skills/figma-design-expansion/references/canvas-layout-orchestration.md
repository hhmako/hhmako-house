# Review Canvas Orchestration

Use this reference for multi-state complete-page expansion, multi-flow canvases, or when the user supplies a reference layout.

## 1. Separate two contracts

- Page-state contract: PRD state -> page modules, copy, visibility, actions, highlights.
- Canvas contract: state relationship -> order, grouping, rows, labels, connectors, spacing.

Never derive canvas structure from the number of generated pages alone. A five-column grid is only correct for a non-sequential variant library.

## 2. Inspect the source canvas before placing output

Read the target area and nearby completed design flows for:

- reading direction;
- lifecycle or process order;
- major phase headers and divider lines;
- rows representing different artifact types;
- columns shared across rows;
- branch clusters and group gaps;
- state strips, state markers, and connector style;
- naming, font, color, and density of review annotations;
- expected placement relative to the requested source node.

If the user provides a reference screenshot or node, treat its grouping and reading path as authoritative. Do not imitate only the visual styling while retaining an unrelated layout.

## 3. Choose a layout from business relationships

| Relationship | Default canvas layout |
|---|---|
| Sequential lifecycle | One horizontal flow, left to right |
| One phase with parallel states | Horizontal cluster within the phase |
| Several artifact types for the same lifecycle | One row per artifact type, shared state columns |
| Alternative end-to-end flows | One section per flow |
| Non-sequential component variants | Compact grid |

For order and after-sales journeys, prefer lifecycle order such as:

`pre-fulfillment -> fulfillment -> signed/received -> service execution -> completion/closure`

Within a phase, order branches from normal/default to exception or recovery unless the PRD defines a different sequence.

## 4. Place complete pages before annotations

1. Confirm every output is the correct complete-page baseline.
2. Arrange pages using the chosen lifecycle and branch structure.
3. Add larger gaps between major phases than between states in one phase.
4. Align page tops inside one artifact row.
5. Preserve requested source adjacency; generated output begins beside the source, not at an arbitrary empty location.
6. Add annotations only after page placement is stable.

Do not use state labels to compensate for an incoherent page order.

## 5. Review annotation rules

Review annotations exist on the design canvas, outside the product screen.

- Per-page marker: one concise state name above each page.
- Phase marker: one label spanning or preceding a related state cluster.
- Row marker: required when the canvas contains multiple artifact types such as order list, order detail, and service detail.
- Connector: use only when it clarifies cross-row or sequential mapping; do not decorate every page by default.

Annotation styling should first reuse the nearby reference canvas. If the user specifies typography or color, that instruction overrides the inferred style. Keep labels single-line; shorten redundant prefixes when the phase header already provides context.

Examples:

- Phase `已签收 · 安装履约` + page marker `待预约｜未派工` is clearer than repeating `已签收｜待预约｜未派工` above every screen.
- A user request for `白色 PingFang SC, Semibold, 24px` applies to the review marker, not to text inside the product page.

## 6. Tool and mutation boundaries

- Use Figma write tools for frame placement and geometry.
- Use the local font bridge only for local-font text creation or replacement.
- The bridge is transport, not the source of layout or business logic.
- Do not change bridge code to repair a wrong canvas plan.
- Do not silently replace unavailable fonts.
- Do not reparent text-bearing frames through a path that cannot preserve their fonts or component instances.
- Stage risky operations: clone -> verify IDs -> place -> verify positions -> mutate copy -> add annotations -> render QA.
- On failure, inspect actual mutations before retrying. Remove partial duplicates before resuming.

## 7. Canvas validation matrix

Validate all of these before reporting completion:

| Dimension | Check |
|---|---|
| Business order | Left-to-right or top-to-bottom sequence matches the lifecycle |
| Branch grouping | Parallel branches sit inside the correct phase |
| Artifact rows | Same artifact type shares one aligned row |
| Phase hierarchy | Phase spacing is larger than within-phase spacing |
| State markers | Every page has one readable marker outside the screen |
| Marker semantics | Labels do not repeat unnecessary phase prefixes |
| Typography | Font family, weight, size, color, and single-line behavior match the reference/user instruction |
| Source adjacency | Output starts beside the requested source node |
| Page integrity | Complete pages retain fixed modules, components, tokens, fonts, and action bars |
| Visual QA | A zoomed-out canvas screenshot and representative page screenshots are both checked |

A canvas is not complete merely because all states exist. The state relationships must be understandable without opening layer names.

## 8. Failure patterns to reject

- Choosing a rectangular grid before identifying lifecycle and branches.
- Stacking sequential states vertically when the source file uses horizontal flows.
- Mixing order stages in the same row without phase headers.
- Adding page labels but leaving the page order illogical.
- Treating canvas annotations as product UI and inserting them inside screen frames.
- Repeating long full-state names when a phase header already supplies context.
- Matching the reference's colors while ignoring its rows, columns, connectors, and grouping.
- Declaring success from tool output without a zoomed-out canvas review.
