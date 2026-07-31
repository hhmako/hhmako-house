# Stability Quality Gates

Use this reference for every Figma + PRD multi-state page or HTML expansion.

## Required order

`read-only inspection -> understanding confirmation -> ledgers -> automated preflight -> one baseline state -> baseline visual acceptance -> remaining states -> final acceptance`

No later step can compensate for a skipped earlier gate.

## Understanding contract

Send this before generation and wait for confirmation:

- Business goal and user task.
- Exact Figma file, page, frame, and review unit.
- Closest complete-page baseline.
- Complete PRD state list, including nested table rows and branches.
- State-varying fields and fixed modules.
- Result shell/canvas layout and output location.
- Conflicts, missing values, unsupported component states, and assumptions.

Do not reduce process names to state names. Read merged headers, sub-rows, annotations, current-version markers, and inheritance rules.

## Asset ledger

Record every visible unit:

`id | visible unit | complete Figma node/original file | child node if relevant | outer box | child inset | direction/rotation | export scale | local asset | status`

Allowed status values: `exact`, `missing`, `conflict`.

Rules:

- `exact` requires a complete Figma component/container or original file.
- Internal vector fragments are not complete icons unless their rendered bounds equal the complete visible unit.
- Screenshot crops, emojis, Unicode, CSS approximations, and visually similar replacements are forbidden.
- A requested raster export must come from the Figma node/original asset, normally at 3x for mobile bitmap delivery.
- Any `missing` or `conflict` blocks implementation.

## State-field ledger

Record:

`state | PRD evidence location | Figma module | exact field/variant | rendered value | visibility/action/highlight rule | evidence status`

Allowed evidence status values: `confirmed`, `derived`, `missing`, `conflict`.

Every PRD state must appear exactly once. Every visible state-dependent field must have evidence. `missing` and `conflict` block that state.

## Baseline-state gate

Choose the state with the richest visible module combination. Implement it before other states and save:

- exact-viewport Figma reference;
- exact-viewport HTML render;
- critical-region comparisons for navigation, progress, hero/status, state card, information card, support modules, and bottom actions;
- computed-style readback for icons, single-line fields, primary actions, and state-dependent modules.

All baseline checks must pass before expanding remaining states.

## Final acceptance manifest

Create a JSON manifest accepted by `scripts/validate_acceptance.py`. Each state must contain:

- exact source reference path;
- exact rendered screenshot path;
- at least one critical-region comparison artifact;
- structural validation result;
- computed-style validation result;
- exact-copy validation result;
- fixed-module validation result;
- visual comparison result.

Every value must be explicit. `unchecked`, `approximate`, or missing evidence fails.

## Completion language

Only say `完成`, `高还原`, `全部通过`, or equivalent when the final validator exits with code 0. Otherwise state the exact failed gate and continue fixing or report the blocker.
