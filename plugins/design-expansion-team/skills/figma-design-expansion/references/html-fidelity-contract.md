# HTML Fidelity Contract

Use this contract whenever a Figma expansion also produces HTML, a local browser artifact, or an interactive product-review demo.

## Implementation model

Build from:

`Figma layer tree + exported source assets + DOM/CSS components + state data/JS`

Do not treat a screenshot as the implementation source. Use screenshots only for visual comparison. If the exact frame, layer context, or source assets are unavailable, state the limitation instead of inventing a visually similar substitute.

## Required review-result shell

For multi-state page expansion, the final HTML artifact must use one consistent review page rather than a loose collection of screenshots or isolated modules.

The required desktop structure is:

`dark review canvas -> left task/state panel + right active-state complete-page preview`

The left panel must contain:

- a concise scene/module eyebrow;
- the result title `完整页面状态拓展`, or an equally specific title when the artifact is not a page-state expansion;
- one short sentence stating the baseline reuse and exact mutation scope;
- one selectable card per generated state, showing the business-state name and its concise visible-result summary;
- a clearly selected state using the same white-card treatment as the reference result page, while unselected states remain dark and subordinate.

The right panel must contain:

- the active business-state name above the preview;
- the complete source-viewport page for that state, including unchanged page shell and fixed modules;
- the original page aspect ratio, scrolling/fixed-layer behavior, real assets, and source component hierarchy.

State selection must switch the complete-page preview inside the same review shell. Do not open disconnected pages, replace the preview with explanatory text, or show only the changed card/module when the requested review unit is a complete page.

Keep review annotations outside the product page DOM. Do not place state names, task descriptions, debug badges, technical logs, or implementation notes inside the reconstructed mobile page. Decorative overlays from the host application are not part of the artifact and must not be reproduced.

This shell is a presentation contract, not a fidelity shortcut. Every state shown in the selector must still pass the full asset, structural, visual, and computed-style acceptance rules below. If the user explicitly requests a different result-page format, follow that request while retaining complete-page previews and the same validation standard.

## Required sequence

1. Read the complete source frame, not only the changing module.
2. Inventory the page shell, modules, component instances, state fields, assets, tokens, scroll regions, fixed layers, clipping, overlaps, and decorative backgrounds.
3. Export or resolve every visible image, icon, tag, illustration, and background to a Figma node or original file.
4. Reproduce the Figma grouping as DOM hierarchy before applying state changes.
5. Apply only mapped PRD fields and supported component/visibility variants.
6. Render every state at the exact source viewport.
7. Compare screenshots region by region and run the structural checks below.
8. Fix mismatches and repeat until both checks pass.

## Non-bypassable pre-implementation gate

Do not start HTML/CSS implementation until both ledgers are complete:

1. Asset ledger: `visible unit | Figma node or original file | exported local asset | exact dimensions/crop`.
2. State-field ledger: `business state | PRD evidence | Figma field | exact rendered value | exact style/highlight evidence`.

If one visible unit or state field lacks an exact source, stop and report it as a blocker. Do not replace it with a screenshot crop, guessed asset, approximate CSS, or inferred copy.

### Complete-component asset gate

Treat this as a hard stop, not a visual preference:

- Resolve every visible icon, badge, tag, illustration, and decorative unit to the **complete Figma component/container node** before implementation.
- Record both the outer container and the rendered child: `component node | child asset node | outer box | child inset | direction/rotation | exported file`.
- An internal `Vector`, `Union`, `Subtract`, path, or mask is not a complete icon merely because it came from Figma. Do not render it directly at the component size.
- Use an internal vector directly only when inspection proves the vector itself is the complete visible unit and its viewBox already equals the rendered bounds.
- Otherwise export the complete component, or reproduce the original outer container and exact child inset/rotation around the source asset.
- Reject any icon whose child is stretched to fill the outer box, whose `preserveAspectRatio` behavior differs, or whose direction is inferred by eye.
- If the complete node cannot be resolved, keep the asset `missing` and stop. Do not substitute a visually similar icon.

### Design-system conformance gate

When the workspace provides a design system such as C-DS, read its current page template, business block, component, token, typography, and gradient rules before writing HTML. Treat these rules as executable constraints:

- use the prescribed font asset and segmented number sizes for prices;
- use the specified button variant and gradient, not an approximate solid color or hand-tuned gradient;
- use component dimensions, radius, padding, icon box, and font weight from the component rule;
- let Figma remain authoritative for the concrete instance and C-DS remain authoritative for reusable component behavior;
- stop on a Figma/C-DS conflict and report it instead of silently choosing a third approximation.

## DOM and coordinate-system rules

- Preserve component grouping. Do not flatten a component or split one semantic group merely because simpler CSS is convenient.
- Derive layout from Auto Layout, constraints, padding, gap, alignment, sizing, clipping, and layer hierarchy.
- Use Flex or Grid for alignment. Never use ordinary or full-width spaces to align content.
- Model fixed, sticky, scrolling, overlapping, clipped, and top-gradient regions explicitly.
- When content changes, recompute the affected row, component, card, section, scroll content, and page bounds in that order.
- Preserve one-line, truncation, and ellipsis contracts. Do not wrap text to make it fit when the Figma field is single-line.

## Asset rules

- Do not simulate icons with Unicode, emoji, text glyphs, CSS punctuation, or approximate shapes.
- Export the complete visual unit. Do not export one internal vector fragment from a multi-layer icon or tag.
- Preserve the source asset's viewBox/inset, crop, aspect ratio, and container size.
- Give icons explicit width and height and `flex: none`; prevent flex stretching or compression.
- Reuse original product images, tags, decorative backgrounds, and service-card graphics. If an asset cannot be resolved, mark it missing and stop or expose the limitation.
- Never use the source screenshot, a crop of that screenshot, or a screenshot sprite as an implementation asset. Screenshots are comparison evidence only.
- Asset-fetch failure must keep the item in `missing` state. Do not fall back to redrawing or cropping.

## Copy and highlight rules

- Only `visible_content` enters the UI. Keep product notes, engineering notes, interaction explanations, and review comments out.
- Do not invent supplementary copy.
- Apply a highlight only when the mapping contains both the target field and the exact literal substring.
- Do not automatically highlight dates, times, amounts, countdowns, or keywords.
- Treat whitespace around highlights as module-specific copy behavior. Never promote one module's spacing rule into a global rule.
- Re-read the latest PRD or mapping source before the final render.

## Visual validation

Render each state separately at the exact source viewport. Compare at least:

- status bar and navigation/title area;
- top gradient/decorative background;
- progress, logistics, or service-status area;
- product/order card and its internal groups;
- supporting/service modules;
- fixed bottom action bar.

Check coordinates, dimensions, hierarchy, font, weight, line height, colors, gaps, padding, radii, borders, clipping, overlap, fixed positioning, background graphics, image crop, and text truncation. A visually plausible overall screenshot is insufficient when any component-level relationship is wrong.

Validation must run at two levels:

1. **Whole-page comparison** — verify the page coordinate system, scrolling, fixed regions, module order, and overall density.
2. **Component-region comparison** — crop or inspect every critical region independently: navigation/search icons, store header and qualification tag, product/price group, progress/extension row, amount group, button group, supporting cards, and bottom bar.

Do not pass a page because the full screenshot looks close. Every critical region must pass independently.

For each critical component, read back computed DOM/CSS values and compare them with Figma/C-DS evidence:

`outer box | child box/inset | font family | font size | font weight | line height | color | background/gradient | radius | overflow | white-space | asset load`

Computed-style readback is mandatory for prices, primary buttons, icon containers, single-line text, and state-dependent modules. A screenshot alone cannot verify these properties.

For every requested state, save and inspect the exact-viewport Figma reference, exact-viewport HTML render, and region-by-region comparison. Missing one of these three artifacts fails that state. Functional checks cannot pass visual validation.

## Structural validation

Reject the output if any of these are true:

- a visible icon is represented by a Unicode or emoji placeholder;
- whitespace characters are used for alignment;
- a visible asset has no Figma-node or original-file provenance;
- an icon can stretch because fixed dimensions or flex behavior are missing;
- an icon uses a Figma internal vector fragment as though it were the complete component;
- an icon's outer box, inner inset, direction, or rotation has not been read from the source node;
- DOM grouping contradicts the source component/layer grouping;
- copy or highlight has no mapping evidence;
- a fixed, scroll, clip, overlap, or background layer differs from the source coordinate model;
- any requested state lacks a same-viewport screenshot comparison.

Also reject the output when:

- a source screenshot or screenshot crop is used as a DOM/CSS asset;
- a PRD phrase is paraphrased, improved, or inferred without explicit evidence;
- a field defined as single-line wraps instead of using the source truncation rule;
- one state inherits invented behavior instead of the PRD's explicit inheritance rule;
- any fixed module differs from the source without a mapped state rule.
- a workspace design-system rule exists for a price, button, tag, typography, or gradient but the HTML uses an approximation;
- only whole-page screenshots were inspected and one or more critical component regions lack independent comparison;
- prices, primary buttons, icon containers, or single-line fields lack computed-style readback.

## Required acceptance matrix

Before reporting completion, produce an internal matrix:

`state | complete component assets | exact structure | exact copy | design-system conformance | viewport render | component-region comparison | computed-style readback | result`

Every cell must be `pass` or `fail`. Unchecked, approximate, visually close, or source-limited cells are `fail`. Report success only when every cell is `pass`; otherwise continue fixing or report the exact blocker.

Only report `high fidelity` after all requested states pass visual and structural validation. Otherwise report the remaining mismatches or source limitations precisely.
