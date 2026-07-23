---
name: figma-design-expansion
description: Use when a user wants to expand an existing Figma design into more business states, page variants, module variants, card states, copy variants, button variants, floor visibility combinations, or a high-fidelity HTML artifact derived from those states. The skill inspects Figma, extracts PRD/Lark/Feishu/sheet evidence into an internal field mapping, decides whether direct generation or compact confirmation is safe, then clones or updates existing nodes while preserving components, tokens, fonts, assets, hierarchy, and layout contracts.
---

# Figma Design Expansion

Use this skill for design expansion work based on existing Figma drafts.

The goal is not to redraw screens. The goal is to understand the current design structure, map business variation internally, and update Figma by cloning or modifying the existing design with minimal visual drift. An external mapping table is optional, not a mandatory gate.

PingFang/font tooling is a dependency, not the skill goal. When local PingFang writing is required, use the Codex PingFang Bridge preflight before writing to Figma.

## Core Principle

Treat the existing Figma design as the visual source of truth. Treat PRD, Lark/Feishu sheets, or user-filled mapping tables as the business source of truth.

First understand the scene and requirement. A mapping table is an output of understanding, not a substitute for understanding.

Before proposing any table or Figma change, infer from the user's words and the design:

- What business scene is this?
- What requirement is the user asking for?
- What exactly needs expansion?
- What can stay unchanged?
- What information is missing?

If the scene, requirement, or expansion object cannot be inferred with confidence, ask the user to supplement it. Do not proceed by creating a generic table.

Separate confirmed facts from guesses:

- Confirmed = explicitly stated by the user or directly visible and unambiguous in the selected Figma frame.
- Candidate = inferred from design structure, layer names, or common workflow, but not yet confirmed by the user.
- Never present candidates as confirmed changing fields.
- Infer the delivery method from the explicit request. If the user asks to generate/expand Figma and provides sufficient PRD evidence, direct Figma generation is the intended delivery. Ask about delivery only when the request itself is ambiguous.

Do not invent layout, modules, button groups, variants, or progress structures when the design file does not support them. If the business mapping asks for a capability that is missing in the design, report the gap and ask for a design baseline or confirmation.

## Universal PRD-to-Design Contract

For any PRD-driven expansion, enforce this order:

`understand design -> normalize requirement -> build internal mapping -> confidence gate -> generate or confirm -> validate`

An internal field-level mapping is always required, but a user-visible mapping table is not. Generate directly from a PRD when the business state, exact Figma destination, and existing component capability are all unambiguous. Ask only about blocking low-confidence fields. Show or create an external mapping table only when the user asks for one, product collaboration is needed, or ambiguity/conflict is too broad for a compact confirmation.

### Gate 0: Finish understanding before tool preflight

Close the understanding gate before starting Bridge setup, font checks, cloning, or any write preparation. First establish:

`business goal | exact Figma target | expansion unit | baseline | changing fields | fixed modules | state source | output placement | unresolved conflicts`

Use read-only inspection of the Figma design and PRD to establish this scope. Then choose one path:

- `direct`: send a concise, checkable understanding message and continue automatically. Do not require a ceremonial confirmation.
- `compact_confirmation`: ask only the blocking ambiguity and wait for the answer.
- `external_mapping`: confirm the mapping purpose and fields before creating the table.

Before this gate closes, do not:

- Start, restart, or ask the user to reopen the local Bridge.
- Run font-write checks or diagnose writable-font availability.
- Clone frames, mutate text, or call any write endpoint.
- Present a tool, connection, or font problem as the current blocker unless it truly prevents read-only understanding.

Tool readiness is not requirement readiness. A connected Bridge cannot substitute for identifying the correct file, page, source frame, state matrix, fixed modules, and intended placement. If understanding shows that the deliverable is analysis or a mapping table rather than a Figma write, do not start the Bridge at all.

### Gate 1: Understand the design before reading business variants

Inventory the target design as:

`complete page -> modules -> component instances -> variants -> text/action fields`

Record:

- The complete-page baseline and required output placement.
- Fixed modules that must survive every state.
- State-dependent modules and their supported variants.
- Module-local actions separately from page-level bottom actions.
- Scroll containers, clipping, and fixed layers.

Do not treat similarly named modules as identical. Resolve each business object to an exact Figma node using its name, hierarchy, component identity, visible copy, and adjacent context.

### Gate 2: Normalize PRD content

PRDs have no reliable writing format. Do not depend on fixed headings, a specific table shape, or the author's terminology. Use a design-first, two-pass extraction.

**Pass 1 — locate evidence and versions**

Classify source regions as workflow, page solution, state machine, interaction rule, engineering/product note, or historical/deprecated content. Detect merged table headers, process-column partitions, screenshots, annotations, highlights, deletion marks, `Before`, old-version labels, and historical方案. Historical or deleted content must not enter the current mapping.

**Pass 2 — fill the design schema**

First derive an empty schema from the actual Figma design:

`state | page title | state explanation | module visibility | module fields | module actions | bottom actions | highlights | dynamic values`

Then search all current PRD evidence to fill those exact fields. This reverse extraction prevents PRD prose from inventing modules that do not exist in the design and reveals missing fields early.

Classify every extracted item before mapping it:

- `visible_content`: literal user-visible text, values, labels, and actions.
- `display_rule`: visibility, condition, countdown, highlight, disabled state, or branching rule.
- `product_note`: background, rationale, interaction explanation, engineering note, or review comment.

Only `visible_content` may populate copy fields. Convert `display_rule` into structured mapping controls. Keep `product_note` out of generated UI. A sentence may contain more than one class; split it at the smallest meaningful fragment instead of assigning the whole sentence to one class.

Fuse evidence across formats:

- Tables: interpret header hierarchy, merged cells, state rows, and workflow/process partitions.
- Screenshots: identify module order, visible fields, button count/copy, and visual differences between states.
- Prose and annotations: extract literal copy, conditions, actions, and exceptions without copying explanatory language into the UI.
- Highlights: preserve the exact highlighted literal substring, not merely the color rule.

Normalize synonymous PRD language into structured controls:

- `不展示 / 隐藏 / 屏蔽 / 该状态无此模块` -> `visible=false`
- `常驻 / 始终展示 / 沿用线上 / 各状态都有` -> `fixed=true`
- `同寄修 / 复用线上 / 沿用原逻辑` -> `inherit=<named baseline>`
- `增加两个操作 / 支持修改和联系` -> `moduleActions=[...]`

For each mapped value, record an evidence status:

- `confirmed`: explicitly supported by the latest authoritative source.
- `derived`: unambiguous conclusion obtained by combining current evidence.
- `conflict`: current sources disagree.
- `missing`: required Figma field has no usable source.

Use this priority when evidence conflicts:

`latest user confirmation > explicit current-solution PRD > state-table field > current-solution image > interaction/rule description > old design or historical screenshot > model inference`

Generation may consume only `confirmed` and unambiguous `derived` values. Collect blocking `conflict` and `missing` items into one compact confirmation round; do not interrupt once per field.

Treat PRD tables, images, prose, annotations, and highlighted text as equal evidence types, then resolve authority with the priority above. Resolve placeholders into explicit sample values and formats before generation. For example, `${剩余时间}` needs a concrete value such as `2天23时29分内`, and `${上门时间}` a value such as `2月10日20:00前`. Never leave unresolved template symbols in the generated design.

### Gate 3: Build a field-level mapping contract

Map each variable as:

`business state -> Figma module -> component variant/field -> value or visibility`

The mapping must distinguish:

- Fixed modules versus state-dependent modules.
- Module-local actions versus page bottom actions.
- User-visible copy versus remarks/rules.
- Exact text replacements versus show/hide or component-variant changes.

Put all fixed-module guarantees in one compact remarks column unless their content varies by state. Do not create one column per fixed module only to repeat `固定展示`.

Before generation, re-read the latest source. Do not require confirmation merely because the internal mapping was newly created. Require confirmation only for blocking `conflict`, `missing`, unsupported capability, or a choice that materially changes the output.

### Gate 3.5: Decide whether direct PRD generation is safe

Direct generation is allowed when all of these are true:

- The user provided a target Figma node and a current PRD/source.
- The review unit is known: complete page, module, or card.
- Every changing PRD field resolves to one exact existing Figma field, visibility control, or component variant.
- Fixed modules and the complete-page baseline are identified.
- Required button/action combinations already exist or can be produced by supported variants.
- No current authoritative sources conflict.
- No new information architecture, interaction pattern, or unsupported component is required.

Use three confidence outcomes:

- `direct`: all critical mappings are `confirmed` or unambiguous `derived`; build the internal mapping and generate without asking for approval.
- `compact_confirmation`: one to three blocking fields are ambiguous; ask only those questions, then continue.
- `external_mapping`: many states/fields are missing, conflicting, or require product collaboration; show/create the smallest useful mapping table.

Never expose a full mapping table just to compensate for weak inspection. Never skip the internal mapping merely because no table is shown to the user.

### Gate 4: Generate with minimal mutation

- Clone the closest complete-page baseline beside the source.
- Preserve the fixed page skeleton.
- Change only fields controlled by the confirmed mapping.
- Prefer existing variants and original text nodes.
- Preserve layout, typography, and scroll/fixed-layer behavior.
- Treat local font bridges only as text transport; never use them to decide layout or component behavior.
- Do not silently downgrade fonts, components, shared styles, tokens, or image modules when the required write path is unavailable. Restore the required bridge/tool or stop with the exact blocker.
- When spacing, text count, proof count, or module visibility changes, recompute the affected content container, card, row, section, and complete-page layout in that order. A property change is incomplete until all dependent bounds are updated.

### Gate 4.5: Orchestrate the review canvas

For multi-state complete-page output, the page content and the review canvas are separate design problems. The PRD controls what changes inside each page. The source Figma canvas or user-provided reference controls how generated pages are grouped, ordered, labeled, and connected for review.

Before placing variants, inspect nearby completed flows, sections, state strips, row labels, connectors, and whitespace. Infer the canvas grammar before choosing a grid. If a reference layout is provided, follow its information architecture rather than merely copying its colors or typography.

Use the smallest layout that exposes the business relationship:

- sequential lifecycle or process -> one horizontal flow from left to right;
- mutually exclusive branches of one stage -> compare horizontally inside that stage;
- different artifact types in the same flow -> align as separate rows with shared columns;
- unrelated flows -> separate sections, not one continuous row;
- compact variant library without sequence -> grid is allowed.

State markers are review annotations, not product UI. Keep them outside the page frame, use one consistent style, and never let them change the page's component tree or layout. Add both per-page state labels and higher-level phase labels when the set spans multiple business phases.

For the full decision and validation contract, read [references/canvas-layout-orchestration.md](references/canvas-layout-orchestration.md) whenever generating four or more complete-page states, a multi-flow state set, or any output with a user-provided layout reference.

### Gate 5: Validate state by state

Use one validation matrix for every generated state:

`state/progress | visible copy | highlights | state modules | fixed modules | module actions | bottom actions | legacy-copy residue | scrolling/clipping`

Validate both structure and rendered output. A successful tool response is not proof that the design is correct. Do not report completion while any mapped field is unchecked, any fixed module is missing, any old-scene copy remains, or content is inaccessible because of clipping or missing scroll behavior.

### Gate 6: Generate high-fidelity HTML only from structured Figma evidence

When the deliverable includes HTML or a browser-preview artifact, read [references/html-fidelity-contract.md](references/html-fidelity-contract.md) completely before implementation. Treat HTML as a renderer over the same page specification and state mapping used for Figma, not as screenshot tracing.

Do not claim high fidelity until every requested state has passed both same-viewport screenshot comparison and structural validation. Missing source assets, incomplete layer context, or unverified coordinate systems are blockers or explicit fidelity limitations, not permission to invent approximations.

## Default Interaction Flow

When the user sends a Figma link and asks to "拓展状态", "拓展设计稿", "拓展卡片", "生成映射表", or similar:

0. Understand the business request before deciding the artifact.
   - Do not start from "make a mapping table." Start from "what is changing and why?"
   - Identify the expansion object: whole page, one module, one card, one field/copy, buttons/actions, floor visibility, or a combination.
   - Identify the variation source: PRD, existing table, user-provided list, product-to-fill later, or not yet available.
   - Identify the desired deliverable: direct Figma generation, product-fill mapping table, local draft table, or just analysis.
   - After inferring these, apply the confidence gate. For `direct`, give a concise understanding/progress update and continue without requiring approval. For `compact_confirmation`, ask only blocking questions. For `external_mapping`, confirm the table purpose and columns before creating it.
   - If the user's words are ambiguous, ask one focused clarification question before generating any table or editing Figma.
   - In the confirmation, distinguish `已确认` from `我从设计稿看到的可变候选`. Do not say `会变化的是` unless the user has confirmed those fields.

1. Gate the user's intent before doing tool-heavy work.
   - If the user says only one field changes, such as "只改主标题", "只改副文案", "只改按钮文案", or "只改一个位置", classify it as copy-only expansion.
   - For copy-only expansion, first clarify source and deliverable if missing instead of assuming a table or direct Figma edit.
   - Ask a confirmation plus input-method question that resolves scope and source, for example: `我理解这次只拓展主标题，其他信息和布局不变。这样理解对吗？如果对，标题可以用 1. 直接发我列表（一行一个） 2. 发 PRD/飞书表格链接 3. 让我先生成主标题映射表给产品填。`
   - If the user chooses direct generation but has not provided the target copy/list, ask only for the missing target copy/list, for example: `主标题要改成什么？如果有多个标题，请一行一个发我。`
   - If the user chooses a table, generate a narrow table that contains only the confirmed variable fields, such as `状态/场景 | 主标题 | 备注/触发条件`.
   - If the user says there are many target copies but has not provided them or chosen a table, do not create states, do not invent copy, and do not edit Figma yet.
   - As the user replies, continuously narrow or revise the table. If the user later says "只改主标题", remove unrelated columns such as service info, bottom buttons, floors, and trigger conditions unless they are still explicitly needed.
   - Do not check `lark-cli` unless the next action actually needs a Lark/Feishu sheet.
   - Do not start the PingFang Bridge unless the next action actually writes to Figma.

2. Inspect the Figma design and relevant business source read-only.
   - Identify the target page/frame/module/card.
   - Read meaningful layer names, text content, component instances, visible floors, buttons, progress/status modules, and repeated structures.
   - Determine whether the target is a page, module, card, or a single copy field.
   - Translate the user's business request into candidate Figma modules, then identify the matching module by its layer name, hierarchy, visible content, and surrounding context. Do not assume that the user's wording exactly matches one layer name.
   - After identifying the module, traverse its named children before extracting copy. Treat layer hierarchy as the field contract: for `标题+正文 > Text` and `标题+正文 > title`, `Text` is body copy and `title` is the title.
   - Expand named component instances before reading their text. Do not infer a field from visual position or the first visible line when an instance/layer name such as `title`, `正文`, `按钮`, or `入口` defines its semantic role.

3. Clarify only what blocks action.
   - Do not require confirmation for high-confidence mappings supported by the target design and current PRD. State the understood scope briefly, then continue.
   - If the user has not stated which fields change, ask them to choose from candidate fields rather than declaring the fields changed.
   - If copy-only scope is detected, clarify whether the user wants direct generation, a plain list, or a mapping table before producing artifacts.
   - If copy-only target content is missing and the user chose direct generation, ask for the copy/list instead of generating a mapping table.
   - If the user wants state/page/module expansion but did not provide target content, generate a structure-aware mapping table rather than guessing future states.
   - If the user gave a PRD/sheet/table, read it and continue.
   - If a required baseline frame, target area, or unsupported design capability is unclear, ask before editing Figma.

4. Close Gate 0, then run preflight checks for the intended output.
   - Send the concise visible understanding first: target, baseline, state scope, variable fields, fixed modules, and output placement.
   - For `direct`, continue automatically after that message. For `compact_confirmation`, wait for the blocking answer before preflight.
   - If the task will write a Lark/Feishu mapping table, check whether `lark-cli` is available and authenticated before promising a live Sheet.
   - If the task will write to Figma with local PingFang text, check the Codex PingFang Bridge only after the correct target file/page and mutation scope are known.
   - If a required tool is missing, report the exact missing tool and use the fallback path only with user awareness.

5. Classify expansion granularity.
   - Single module copy
   - Single module with multiple copy fields
   - Module state
   - Card state
   - Page state
   - Multi-flow page state
   - Existing design capability gap
   - Mapping-table-only task

6. Generate or read the mapping table only after the request is understood.
   - For incomplete business input, create a Lark/Feishu Sheet that product/design can fill.
   - For complete business input, build the field-level mapping internally and continue directly to capability checks. Do not create an external table by default.
   - Build table headers from the actual Figma structure and the user's expansion intent. Do not use a universal fixed schema.

7. Check design capability before editing.
   - Compare table needs against the current design.
   - Stop on unsupported button count, missing module/floor, missing progress state, or unavailable component variant.
   - Do not silently draw a new component just to satisfy a row.

8. Apply updates in Figma.
   - Before cloning, confirm the review unit and placement: `整页副本`、`仅卡片副本`，以及是否放在源设计右侧。 Do not infer a card-only output from a copy-only field change.
   - Clone the closest baseline frame/card/module that matches the confirmed review unit. If the user asks for page variants, clone the complete page/frame rather than extracting only the changed card.
   - Reuse existing components and variants.
   - Replace original text nodes instead of drawing overlay text.
   - For rich-text copy, reset the target text node to its baseline/default text fill first, then apply only the explicitly mapped highlight ranges. Never leave a stale highlight range from a prior row.
   - Text replacement is content-only: do not change `textAutoResize`, width, height, x/y, alignment, auto-layout sizing, parent layout, component instance, or typography unless the mapping explicitly requests it.
   - Toggle visibility for optional floors/buttons when supported.
   - Hide empty bottom bars when there are no actions.
   - Preserve typography, spacing, component instances, frame hierarchy, and visual style.
   - For state expansion inside a complete page, keep the page as the review unit when the user asks for page variants. Clone the whole page and mutate only the mapped state slots.
   - Treat status copy, status color semantics, progress/expansion copy, bottom-button composition, button order, overflow/more actions, and module visibility as separate state fields. Do not infer one from another.
   - Preserve the source text node's single-line, truncation, and auto-resize contract. If the source status field is single-line with ellipsis, replacement copy must remain single-line with ellipsis; never wrap it to make the copy fit.
   - Derive status color from the source component variant or explicit state semantics. A field being in an emphasized position does not make every value red; neutral completion states must retain their neutral style.

9. Validate.
   - Compare generated frames against the mapping table.
   - Check state title, card title, copy, buttons, visible floors, progress/current node, information fields, and unsupported gaps.
   - For rich-text rows, verify the exact highlighted substring and verify all surrounding characters retain the baseline color.
   - For copy-only rows, verify the target text node still has its original layout contract (position, width/height, auto-resize, alignment, and parent sizing), then inspect at least one rendered variant visually.
   - Fix only mismatches; do not reapply broad replacements over correct frames.
- For page-state sets, verify every generated frame is a complete-page clone, sits beside the requested source node, and differs only in internally mapped state slots.
- For multi-state canvases, verify business order, branch grouping, phase spacing, state-marker placement, row alignment, and source adjacency. A clean grid is not valid when it hides the lifecycle or branch logic.
   - For button areas, validate the complete ordered combination, including hidden actions and overflow/more-menu ownership. Validating only the visible primary button is insufficient.
   - After changing spacing or child count, verify child bounds, container height, card height, row position, section height, clipping, and overlap.

## Scenario Routing

| Scenario | How to Recognize | What To Do | What Not To Do |
|---|---|---|---|
| Single field one-off copy | User says only one position/field changes and provides one target copy | Replace that exact text node only | Do not create a mapping table, do not clone multiple states |
| Single field multiple copy variants | User says only one field changes but there are many target copies, such as many main titles | Ask whether to use a direct line-by-line list or a narrow mapping table; confirm whether review output is complete-page copies or card-only copies; after receiving values, clone the confirmed baseline unit and replace only that field | Do not ask for service info/buttons/floors; do not keep a broad table after scope narrows |
| Single module single copy | Only one visible text field changes, such as one subtitle/status line | Ask for target copy if missing; replace that node only | Do not clone the page unless the user asks for variants |
| Single module multiple copy | One module/card changes several texts, such as title, subtitle, tag, button | One row per state only when multiple states are actually provided or requested; columns are the module's visible fields | Do not expose "模块单元" as product-facing wording |
| Card state expansion | A card has state text, middle expansion area, buttons, tags, or entries | Clone/update the card component/frame; keep surrounding page fixed | Do not consider unrelated page modules |
| Order-list page state | A complete order-list page is repeated while one order card changes status, progress copy, and actions | Clone the complete page beside the source; internally map right-side status, semantic color, progress title/body, ordered bottom-button combination, overflow actions, and visibility; preserve single-line ellipsis | Do not output isolated cards when complete pages were requested; do not make all statuses red; do not omit buttons or allow status/progress text to wrap |
| Module state expansion | One module varies as a unit, such as status card, progress, prompt card, bottom bar | Reuse variants/properties if present; otherwise clone module baselines | Do not duplicate whole pages unless needed for handoff |
| Page state expansion | Many page modules/floors/actions combine differently per business status | One row per state; clone closest page baseline; apply copy/floors/actions | Do not force all states into one giant component |
| Multi-flow page state | Several flows share the same skeleton but differ in progress/floors/actions | Separate tabs or sections by flow; headers follow each flow's structure | Do not merge flows into a confusing single table |
| Existing components support expansion | Components/instances have variants or visibility properties for needed states | Switch variants, override text, toggle visibility | Do not detach or rebuild components |
| Raw layers but stable structure | No component system, but repeated structure is obvious | Generate mapping sheet and clone/update raw frames carefully | Do not silently create a new master component unless user asks |
| Missing design capability | Mapping needs unsupported module, button count, progress structure, or floor | Report a blocking gap and ask for baseline/confirmation | Do not invent the missing design |
| Table-only | User asks for mapping table or needs product to fill first | Generate a Lark/Feishu Sheet only | Do not generate Figma screens yet |

Use the smallest action that solves the user's stated goal.

## Mapping Table Logic

The mapping table is a collaboration artifact. It should be easy for product owners to fill in one pass.

The mapping contract and the mapping table are different things:

- Internal mapping contract: mandatory for every multi-state generation and may remain invisible to the user.
- External mapping table: optional collaboration/confirmation artifact.

When a complete PRD and an inspectable Figma baseline provide high-confidence mappings, generate directly from the internal contract. Do not ask the user to approve information that is already unambiguous in the authoritative sources.

Before generating a mapping table, be able to answer:

- What business object is being expanded?
- What is the expansion granularity: page, module, card, field, action, floor, or combined state?
- Which fields are confirmed to change?
- Which fields are confirmed to stay unchanged?
- Who will provide the values: user now, PRD/sheet, or product later?
- Is the table meant for product to fill, or is a plain user-provided list enough?
- Does the current Figma design support the requested variation?

If these answers are not clear, ask a focused clarification question first. Do not generate a broad "just in case" table.

Do not generate a mapping table for every expansion task. A mapping table is needed when the user asks for one, when product/business owners need to fill missing state data, or when multiple fields/modules/states must be coordinated. Single-module or single-field copy work can also use a table, but only after clarifying that the user wants product-fill/table workflow instead of direct generation.

For copy-only work:

- First ask whether the user wants direct generation, a plain list, or a product-fill mapping table if it is not clear.
- If there is one target copy and the user wants direct generation, ask for that copy and update directly.
- If there are many target copies for the same field, ask whether to use a plain list or a narrow table.
- Treat a plain list as the mapping source. Do not convert it into a Feishu Sheet unless the user asks or the list needs product collaboration.
- If using a table for one field, keep it narrow. Example: `状态/场景 | 主标题 | 备注/触发条件`.
- If any part of a text field needs a color/style override, add an explicit `高亮文本` column. Its value must be the exact literal substring to style, such as `顺丰、中通、韵达`; do not rely on a vague note such as `物流词高亮`, and do not infer a larger range.
- Immediately before every Figma write, re-read the current mapping source. A product/user update to the sheet supersedes an earlier in-memory row.
- Example: If the user says "只改主标题" and later says "有好多" but has no list yet, ask: `这些主标题你准备用哪种方式给？1. 直接发我列表（一行一个） 2. 发 PRD/飞书表格链接 3. 我先生成主标题映射表给产品填。`

### General Rules

- Row = one business state/variant/scenario.
- Columns = only fields that the current design and current expansion task need.
- Generate headers from the inspected design structure, not from a fixed template.
- Use product-facing business language, not internal design hierarchy terms.
- Do not include columns for every possible optional floor if most states do not need structured detail.
- Put low-frequency details into `备注/触发条件`.
- For optional floors where content may or may not change, use a compact `页面楼层` or `展示楼层` column plus `备注/触发条件`.
- If a floor is high-frequency and has structured content in many states, promote it to its own column.
- If a module only needs show/hide, product can list it in `页面楼层`/`展示楼层`; blank means hidden.
- If a module needs content changes, product writes the changed fields in either that module column or `备注/触发条件`, depending on frequency.
- Leave rows below the current example blank unless the user/PRD/sheet already provides states.
- Do not prefill imagined states.

### Header Selection By Granularity

Use these headers only after deciding that a mapping table is actually needed. Do not use them for ordinary copy-only clarification.

Single module copy:

| 状态 | 文案 | 备注/触发条件 |
|---|---|---|

Single module multiple copy:

| 状态 | 主文案 | 副文案 | 按钮/入口 | 备注/触发条件 |
|---|---|---|---|---|

Card state:

| 状态/场景 | 右上角状态 | 中间拓展区 | 下方按钮 | 备注/触发条件 |
|---|---|---|---|---|

Page state with progress and floors:

| 页面编号 | 页面/状态 | 页面标题 | 顶部进度条 | 当前节点 | 主状态文案 | 副文案 | 页面楼层 | 信息卡字段 | 底部按钮 | 备注/触发条件 |
|---|---|---|---|---|---|---|---|---|---|---|

These are examples, not templates. Remove columns that the current design does not have. Add columns only when the inspected design and expansion goal require them.

### Seed Row Rules

When generating a mapping sheet before product copy is complete:

- Fill exactly one example row from the current Figma design.
- The state cell must use the actual visible state, such as `待支付`, `等待服务商处理`, or `售前自主`, not `当前样例`.
- Use the visible Figma copy, buttons, floors, and fields exactly.
- Leave `备注/触发条件` blank unless the design visibly contains a trigger note or the user asks for a note.
- Leave following rows blank for product owners.

### Remark Column Guidance

Tell the user/product that `备注/触发条件` can be used for:

- Trigger conditions
- Low-frequency module copy changes
- Special button rules
- Countdown rules
- Edge cases
- Unsupported design capability notes
- Optional floor details that do not deserve their own column

Do not write agent execution notes into product-facing remark cells.

## Capability Gap Rules

Before Figma editing, compare the mapping needs with the design file.

Report a gap when:

- The design has two buttons but a state asks for three.
- The design has no version of a requested floor/card/module.
- The progress component supports four nodes but the state asks for three or five without an existing variant.
- The current design only has static text but the requested state needs a new structured area.
- The user asks to switch component states but the layer is not a component/instance and no matching baseline exists.

Gap handling:

- Stop and explain the exact gap.
- Ask whether the user/designer will add the missing component/baseline, or whether an existing design element should be used.
- Do not create unsupported components on your own.

## Figma Execution Rules

When writing Figma:

- Before any Figma write or local PingFang Bridge call, read [references/figma-call-reliability.md](references/figma-call-reliability.md) completely. Its readiness gates, channel boundaries, staged-execution sequence, failure recovery, font rules, and dual validation are mandatory.
- Do not treat the plugin's `Connected` message or an `ensure` command returning successfully as proof that writing is safe. Confirm the listener, service health, plugin capabilities, current file/page, and exact target node immediately before each write batch.
- Execute fragile changes in bounded stages and return node IDs after each stage. On any failure, inspect current Figma state and resume only the unfinished stage; never blindly rerun the full workflow.
- Use official Figma MCP tools for inspection and write actions.
- Load the `figma-use` skill before every `use_figma` write/read script that executes in Figma.
- If using local PingFang text writing, run the Codex PingFang Bridge preflight:
  - `npm run setup`
  - `FIGMA_URL="<figma link>" npm run ensure`
  - Verify `/probe` has empty `missingPluginCapabilities`.
  - Verify `/debug-current-page` returns ok.
  - Verify `/replace-text` can return with empty replacements.
- Treat the local PingFang Bridge strictly as a transport/font-writing channel, not as a design component or layout mechanism. A layout or component problem must be fixed in the Figma design; a text-write problem must be fixed in the text-write payload/implementation.
- Before batch text writes, verify the bridge is connected to the intended Figma file and page. Do not trust a merely `Connected` status if the current file/page is not the requested one.
- Treat component and token inheritance as immutable unless the mapping explicitly changes style. Copy changes may override `characters`, visibility, and exact rich-text highlight ranges only; they must preserve the source `textStyleId`, variable bindings, component ancestry, and non-highlight fills.
- A bridge text-write payload must have token-preserving replace semantics: capture the target/source text style and bound paints before changing characters, restore them afterward, then apply the current row's exact highlight ranges. Never reset `fontName`, font size, weight, line height, or fills to local values merely to make text writable.
- When a Bridge cannot preserve token bindings natively, pass an exact source text node for style restoration or stop. Do not accept a visually correct result whose Typography or Fill panel shows local values instead of the source style/token.
- Prefer replacing existing text nodes through the bridge or Figma API after loading fonts.
- Preserve original node IDs only when editing in place; return all created/mutated IDs when using scripts.
- Clone near the source design, usually beside the baseline frame or in the user's requested output area.
- Compute placement from the requested source node's absolute bounds, not the current viewport, selection, or generic canvas whitespace. For a right-side output, use `source absolute right edge + explicit gap`.
- Name generated frames with business state names.
- Do not leave empty bars, hidden placeholder layers, or overlay text that visually duplicates original text.
- Reuse in this order: existing component variant -> existing component instance -> cloned original raw node -> newly created node only after an explicit capability-gap decision. Copy original text/image nodes when adding repeated rows; do not recreate approximate equivalents from visual measurements.
- Validate font family, `textStyleId`, bound typography variables, bound fill variables, rich-text highlight ranges, and component instance identity separately. A correct-looking screenshot does not prove token/component reuse.
- For historical generated work, audit instances by comparing every overridden text descendant with its corresponding main-component text node. Restore missing source styles/tokens in place, preserve current characters and highlights, and verify the instance still has its original `mainComponentId`.

## Lark/Feishu Sheet Rules

When a mapping table is needed:

- Use local `lark-cli` first for Feishu/Lark sheets.
- Before creating or reading sheets, check:
  - `command -v lark-cli` or the known local install path.
  - `lark-cli` can access the current tenant/account.
  - The target link type is supported. If a wiki link resolves to a sheet, switch to the sheet export/read path.
- If `lark-cli` is missing:
  - Do not pretend a live Feishu Sheet was created.
  - Tell the user that live Feishu sheet generation requires `lark-cli`.
  - If installation instructions are known in the workspace, install or ask for permission to install.
  - If installation is not available, generate a local `.xlsx` or Markdown/CSV mapping table as a fallback and clearly label it as a fallback.
- If `lark-cli` exists but is not authenticated:
  - Ask the user to complete the CLI login/auth step.
  - Do not ask product owners to fill a local fallback unless the user accepts the fallback.
- If `lark-cli` can read but cannot create/update:
  - Use it to read PRD/source sheets.
  - Provide a local `.xlsx` fallback for the generated mapping table, or ask the user for a target sheet where updates are allowed.
- Create a Sheet, not a doc, unless the user explicitly asks for a doc.
- Format the first row as the header.
- Try to apply automatic wrapping; if it does not visibly apply through CLI, set practical widths/heights and do not keep retrying.
- Return the sheet URL and a short fill guide.

## Layer Naming Standard

When organizing or evaluating design layers for expansion:

| Layer Type | Naming Rule | Examples |
|---|---|---|
| Business layer | Name by business meaning across `页面 / 模块 / 模块构成 / 模块单元 / 子状态` | `服务详情`, `售前自主卡片`, `按钮`, `状态=已取消` |
| Layout-only layer | Use `布局层` | `布局层` |
| Global component | Keep original master component name | Existing library/component names |

Rules:

- Business names should answer "what business thing is this?"
- Same-kind objects should be named at the same hierarchy depth.
- Add `子状态` only when business meaning changes.
- Use `属性=值` for state-like layer names, such as `按钮数=2` or `楼层=隐藏`.
- Do not rename global components unless the user explicitly asks.

## Requirement-to-Layer Identification

Before creating a mapping table or changing copy, map the user's requested business object and field to an exact Figma module and source node. Use layer names, hierarchy, instance names, visible copy, and adjacent business context together; do not map by visual position or first-match text alone. Record the chosen module and the exact source node for every variable field.

For a request to change a card title, first identify the intended card from the request, then follow its child named `title` and inspect the instance content. Do not use a sibling such as `Text`/`正文` merely because it appears above it. If more than one module could match, or layer names and visible copy conflict, stop and ask for clarification before editing.

## Output Style

In chat, keep responses decision-focused:

- Before generating a table or editing Figma, use a short understanding block only when it changes a decision, exposes candidates, or requests confirmation:
  - `我初步理解这是：[业务场景，如不确定就写待确认]`
  - `要拓展的对象可能是：[页面/模块/卡片/字段]`
  - `用户已明确会变化的是：[只写用户明确说过的字段；没有就写未确认]`
  - `我从设计稿看到的可变候选是：[候选字段，如主标题/副文案/入口/按钮；不要当成事实]`
  - `暂时看起来可保持不变的是：[候选不变模块，如布局/样式；不确定就写待确认]`
  - `交付方式：[从用户明确请求推断；只有请求含糊时才写待确认]`
  - When information is incomplete, ask the user to provide the expansion values/states with clear options:
    - `请先确认：这次到底要拓展哪些字段？`
    - `1. 只改某个字段：告诉我字段名和值/列表`
    - `2. 多字段/多状态：发 PRD 或飞书表格链接，我来提取`
    - `3. 还没整理好：我先按确认后的字段生成映射表，你或产品再补充`
- Say what expansion type was detected.
- Say which modules/fields are confirmed to vary, and which are only candidate variable fields from the design.
- Say whether a mapping table is needed or enough information exists to generate.
- Say any design capability gaps before editing.
- After generation, summarize created/updated Figma frame names and validation results.
- For copy-only missing-content cases, do not present a table or broad capability inventory. Ask the shortest blocking question, such as `主标题要改成什么？` or `把主标题按一行一个发我。`
- If the user says no copy list exists yet, stop before editing and state that no valid variants can be generated without the list. Do not invent titles.

### Gate 6.5: Enforce HTML acceptance as a hard stop

Treat the HTML fidelity contract as an executable acceptance gate, not advisory guidance:

- Before writing HTML, create a source ledger for every visible image, icon, tag, illustration, background, and decorative unit: `visible unit -> Figma node/original asset -> local output asset`. If any visible unit has no exact source, stop before implementation.
- Reject screenshots, screenshot crops, screenshot sprites, CSS approximations, Unicode, emoji, punctuation, and text glyphs as substitutes for Figma assets. Asset-fetch failure is a blocker, not permission to change strategy.
- Before changing state copy, create a field ledger: `state -> exact PRD evidence -> exact Figma field -> rendered value/style`. Missing or conflicting evidence must stop that state. Never improve, paraphrase, or infer visible copy.
- Render every requested state at the source frame exact viewport and save one comparison screenshot per state. A state without a same-viewport comparison is automatically failed.
- Fail on simulated icons, screenshot-derived assets, single-line-field wrapping, incorrect fixed/scroll/clip models, missing fixed modules, invented copy/highlights, or unsupported state behavior.
- Record `pass/fail` for assets, structure, copy, viewport, and visual comparison for every state. `Not checked`, `approximate`, and `visually close` mean `fail`.
- If any cell fails, continue fixing or report the exact blocker. Do not say `完成`, `已校验`, `高还原`, or equivalent success language.
- Page load, state switching, DOM presence, dimensions, and no-overflow checks are functional checks only; they never substitute for fidelity acceptance.

Completion requires:

`all source assets exact AND all mapped copy evidenced AND all states structurally valid AND all same-viewport comparisons passed`

Anything less is an incomplete artifact.
