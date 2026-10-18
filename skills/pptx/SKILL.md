---
name: pptx
description: Create, edit, and analyze PowerPoint presentations with professional data visualizations. Converts HTML slides with ECharts to .pptx format. Routes to html2pptx.md (technical reference), ooxml.md (editing), slide-selection-guide.md (120 templates), and branding/README.md (color system).
license: MIT. LICENSE.txt has complete terms
---

# PPTX Skill

## Quick Reference

| Task | Go To | Key Command |
|------|-------|-------------|
| **Create new slides** | This file → [FIRST: How Many Slides?](#first-how-many-slides) | `node scripts/html2pptx-cli.mjs <files> -o output.pptx` |
| **Technical HTML/CSS rules** | [`html2pptx.md`](html2pptx.md) | Read FULLY before authoring |
| **Pick a template (120)** | [`slide-selection-guide.md`](slide-selection-guide.md) | Match content → category → example |
| **Reusable HTML patterns** | [`slide_standardisation.md`](slide_standardisation.md) | Title zone, container box, takeaway box |
| **Pre-flight checks** | [`preflight-checklist.md`](preflight-checklist.md) | Template selection + content limits |
| **Post-flight checks** | [`postflight-checklist.md`](postflight-checklist.md) | Visual validation + self-scoring |
| **Common failures** | [`COMMON_FAILURES.md`](COMMON_FAILURES.md) | Avoid production mistakes |
| **Edit existing .pptx** | [`ooxml.md`](ooxml.md) | Unpack → edit XML → repack |
| **Color system** | [`branding/README.md`](branding/README.md) | All CSS variables + brand config |
| **Chart selection** | [`references/chart-selection-guide.md`](references/chart-selection-guide.md) | Bar vs line vs pie decision tree |
| **Design inspiration** | [`references/design-inspiration.md`](references/design-inspiration.md) | Color palettes + visual techniques |
| **Utilities** | [`references/utilities.md`](references/utilities.md) | Thumbnail grids, image conversion |
| **Dependencies** | [`references/dependencies.md`](references/dependencies.md) | `bash scripts/preflight_check.sh` |
| **Troubleshooting** | [`references/troubleshooting.md`](references/troubleshooting.md) | Error diagnosis + fixes |

---

## FIRST: How Many Slides?

**Before reading ANY workflow section, count the slides in the request.**

| Slide Count | Your Role | Go To |
|-------------|-----------|-------|
| **1-2 slides** | You create slides yourself | [Single-Slide Workflow](#single-slide-workflow-1-2-slides-only) below |
| **3+ slides** | You are the ORCHESTRATOR — spawn sub-agents | [Multi-Slide Presentations](#multi-slide-presentations-sub-agent-parallelization) below |

> **THE RULE**: 3+ slides = parallel sub-agents. You plan the deck, spawn one `claude -p` background process per slide (all in ONE message), monitor completion, create the executive summary yourself, then assemble/harmonize. You do NOT write body slide HTML yourself. If you are about to write slide HTML for a body slide, STOP — you are violating this rule.

**Why**: A single agent writing 5+ slides sequentially exhausts context, loses quality on later slides, and cannot iterate properly. Sub-agents get fresh context per slide.

---

## Multi-Slide Presentations (Sub-Agent Parallelization)

**For 3+ slides, you MUST spawn sub-agents.** Each sub-agent creates ONE slide autonomously. You are the ORCHESTRATOR — you do NOT author individual slides yourself.

**Why**: A single agent creating 5+ slides sequentially will exhaust its context, lose quality on later slides, and cannot iterate properly. Sub-agents get fresh context for each slide.

### Architecture

```
ORCHESTRATOR (you)
  ├─ 1. PLAN         — Design deck structure, define every slide
  ├─ 1b. PREPARE     — Run preflight, mkdir, write prompt files
  ├─ 2. SPAWN        — Bash(run_in_background=true) per slide → claude -p in parallel
  ├─ 3. MONITOR      — TaskOutput(task_id) for each; verify HTML + PPTX files exist
  ├─ 3b. EXEC SUMMARY — YOU create the exec summary slide directly (read executive-summary-task.md)
  ├─ 4. ASSEMBLE     — Combine all HTMLs into final PPTX
  ├─ 5. HARMONIZE    — Read every thumbnail, fix cross-slide inconsistencies
  └─ 6. DELIVER      — Final QA + Delivery Attestation
```

### Step 1: Plan the Deck

Before spawning any sub-agent, create a complete deck plan:

| Field | What to Define |
|-------|---------------|
| **Deck title** | The presentation title |
| **Objective** | What the presentation should achieve |
| **Target audience** | Who will view this |
| **Tone** | Formal / consultative / technical / etc. |
| **Brand** | Brand name for `PPTX_BRAND` (or "default") |
| **Slide list** | For each slide: position, name, category, content summary, example HTML path. **Mark the executive summary slide** — it will be spawned after all other slides complete (Step 3b). |

Verify deck structure follows `slide-selection-guide.md` §2A: COVER + EXEC SUMMARY + BODY + NEXT STEPS + CLOSING.

#### Step 1b: Prepare Environment

Before spawning any sub-agents:

1. Run preflight and create output + prompts directories:
```bash
bash "{WORKING_DIR}/scripts/preflight_check.sh" 2>&1
mkdir -p "{OUTPUT_DIR}" "{OUTPUT_DIR}/prompts" "{OUTPUT_DIR}/logs"
```

2. **Write a prompt file for each non-executive-summary slide** to `{OUTPUT_DIR}/prompts/{SLIDE_NAME}-prompt.md`. Each prompt file contains the full sub-agent instructions (see template in Step 2). Writing to a file avoids shell escaping issues with long prompts.

### How to Spawn Parallel Sub-Agents — Background CLI (MANDATORY for 3+ slides)

**For 3+ slides, spawn parallel `claude -p` processes.** Each process is an independent Claude Code session that creates ONE slide autonomously. You are the ORCHESTRATOR — you coordinate, monitor, and create the executive summary yourself.

**Why background CLI instead of Task?** The Task tool blocks until each sub-agent completes (~3-5 min per slide). Background `claude -p` processes via `Bash(run_in_background=true)` run truly in parallel — all slides build simultaneously.

**Sub-agent prompt template:**

For each non-executive-summary slide, write a prompt file `{OUTPUT_DIR}/prompts/{SLIDE_NAME}-prompt.md` with this content:

```
You are creating ONE slide for a multi-slide presentation. Other sub-agents are building other slides in parallel. Work autonomously.

### Deck Context
- **Deck title**: {DECK_TITLE}
- **Deck objective**: {DECK_OBJECTIVE}
- **Target audience**: {TARGET_AUDIENCE}
- **Tone**: {TONE}
- **Brand**: {BRAND} (use PPTX_BRAND={BRAND} when generating)
- **Total slides in deck**: {TOTAL_SLIDES}
- **Your slide position**: Slide {SLIDE_INDEX} of {TOTAL_SLIDES}
- **Other slides in this deck**: {BRIEF_LIST_OF_ALL_SLIDES_WITH_THEIR_CONTENT}

### Your Slide Assignment
- **SLIDE_NAME**: {SLIDE_NAME}
- **SLIDE_CONTENT**: {SLIDE_CONTENT}
- **SLIDE_CATEGORY**: {SLIDE_CATEGORY}
- **EXAMPLE_PATH**: {EXAMPLE_PATH}
- **WORKING_DIR**: {WORKING_DIR}
- **OUTPUT_DIR**: {OUTPUT_DIR}

### What To Do
1. Read `{WORKING_DIR}/sub-agent-instructions.md` COMPLETELY — your authoritative process document defining the 8-phase pipeline, validation rules, and quality standards. Do NOT start writing HTML until you have read the entire file.
2. Read `{WORKING_DIR}/references/slide-content.md` COMPLETELY — content crafting guidelines.
3. Follow the CREATION pipeline end-to-end. You have SLIDE_CONTENT — that makes this a creation task.
4. When done, output the FINAL REPORT from sub-agent-instructions.md Section 6.
```

> **ANTI-PATTERN — Serial Execution (PROHIBITED)**
>
> ```
> ❌ Task(slide-1) → wait → Task(slide-2)        ← WRONG: Task blocks for minutes
> ❌ Creating slides yourself one by one            ← WRONG: you are the orchestrator, not a slide author
>
> ✅ Write prompt files → Bash(run_in_background) for ALL slides in ONE message → TaskOutput to monitor
> ```

**Common mistakes to avoid:**
- Writing slide HTML yourself (for body slides) instead of spawning sub-agents → WRONG. You are the ORCHESTRATOR.
- Using the Task tool for slides → WRONG. Task calls block for minutes. Use background CLI for true parallelism.
- Spawning a sub-agent for the executive summary → WRONG. You create it yourself after all other slides complete.
- Not including "Read sub-agent-instructions.md" in the prompt → WRONG. Sub-agents need the full pipeline.
- Sending Bash(run_in_background) calls across separate messages → WRONG. ALL calls go in ONE message for parallelism.

### Step 2: Spawn Background Sub-Agents

**Write prompt files in Step 1b, then spawn ALL sub-agents in a SINGLE message using Bash(run_in_background=true).**

For each non-executive-summary slide, include one Bash tool call:

```bash
cat "{OUTPUT_DIR}/prompts/{SLIDE_NAME}-prompt.md" | claude -p \
  --allowedTools "Read,Write,Edit,Bash,Glob,Grep" \
  --permission-mode acceptEdits \
  --add-dir "{WORKING_DIR}" \
  --add-dir "{OUTPUT_DIR}" \
  > "{OUTPUT_DIR}/logs/{SLIDE_NAME}.log" 2>&1
```

**Critical**: Use `run_in_background=true` on EVERY Bash call and include ALL of them in a SINGLE response message. This is what makes them run in parallel. Each Bash call returns a `task_id` — save these for monitoring.

**Example** (7-slide deck with 6 non-exec-summary slides):
In ONE message, call Bash 6 times with `run_in_background=true`:
- `cat .../cover-prompt.md | claude -p --allowedTools ... > .../logs/cover.log 2>&1`
- `cat .../market-overview-prompt.md | claude -p --allowedTools ... > .../logs/market-overview.log 2>&1`
- `cat .../migration-framework-prompt.md | claude -p --allowedTools ... > .../logs/migration-framework.log 2>&1`
- ... (one per slide)

### Step 3: Monitor Sub-Agents

Use `TaskOutput` to wait for each background process to complete:

1. **Wait**: Call `TaskOutput(task_id=..., block=true)` for each task_id from Step 2
2. **Verify**: For each completed sub-agent, confirm:
   - HTML file exists at `{OUTPUT_DIR}/{SLIDE_NAME}.html`
   - PPTX file exists at `{OUTPUT_DIR}/{SLIDE_NAME}.pptx`
   - Log file shows a passing score (≥ 8.5)
3. **Re-spawn**: If a sub-agent failed (exit code ≠ 0 or files missing), spawn a replacement with the same prompt file

### Step 3b: Create Executive Summary (YOU — the Orchestrator)

**The executive summary is the ONE slide you create yourself.** You have all the context from monitoring sub-agents. Do NOT spawn a sub-agent for this.

1. **Read** `{WORKING_DIR}/references/executive-summary-task.md` COMPLETELY — the Bold-Bullet framework, Skimmability Test, and dot/dash hierarchy.
2. **Read** `{WORKING_DIR}/references/slide-content.md` COMPLETELY — content crafting guidelines.
3. **Synthesize** the SLIDE_CONTENT for the executive summary from all completed slides' content.
4. **Read** `{WORKING_DIR}/sub-agent-instructions.md` and follow the CREATION pipeline:
   - EXAMPLE_PATH: `structure-summary/executive-summary.html`
   - SLIDE_CATEGORY: STRUCTURE
   - SLIDE_NAME: executive-summary
5. **Generate**: `node "{WORKING_DIR}/scripts/html2pptx-cli.mjs" "{OUTPUT_DIR}/executive-summary.html" -o "{OUTPUT_DIR}/executive-summary.pptx" 2>&1`

**Wait to proceed to Step 4 until the executive summary HTML + PPTX are ready.**

### Step 4: Assemble

Combine all HTMLs into the final deck (slides in presentation order):

```bash
node scripts/html2pptx-cli.mjs \
  {OUTPUT_DIR}/cover.html \
  {OUTPUT_DIR}/executive-summary.html \
  {OUTPUT_DIR}/body-slide-1.html \
  ... \
  -o output/final-deck.pptx 2>&1
```

### Step 5: Harmonize (MANDATORY — Do NOT Skip)

After assembly, **you the orchestrator MUST** read every slide thumbnail and fix cross-slide inconsistencies.

#### 5a. Read all thumbnails

Use the Read tool to open every slide thumbnail from the assembled PPTX. The CLI prints paths prefixed with `▸ READ:`.

#### 5b. Check cross-slide consistency

For every pair of slides, compare:

| Check | What to Compare | Decision Rule |
|-------|----------------|---------------|
| Typography tiers | Title size, body size, caption size | Use the **most common** pattern. If tied, use brand defaults from `branding/{BRAND}.json` |
| Container styling | Border weight, color, header background, radius | Use the **most common** style. If tied, use the style from the executive summary slide |
| Color palette | Same brand colors, no rogue hex values | Replace any non-brand hex with `var(--brand-*)` |
| Footer format | Same format on every slide (e.g., "Source \| Page N") | Standardize to the format used on the majority of slides |
| Title styling | Font, size, color, position | Must be identical on all slides |
| Spacing/margins | Outer margins, panel gaps | Standardize to the most common values |

**Exemptions:** Cover slides and closing slides may legitimately differ from body slides (larger title, different layout). Compare them against their own category (structural), not against body slides.

#### 5c. Fix inconsistencies

Edit the offending HTML files, re-assemble into a new PPTX, re-generate thumbnails.

#### 5d. Verify fixes

Re-read all thumbnails. Confirm the inconsistencies are resolved. Fixes can introduce new issues — check for regressions.

#### 5e. Completion criteria

Harmonization is complete when:
- All body slides share the same typography tiers, container styling, footer format, and spacing
- All structural slides (covers, closings) are internally consistent with their category
- Zero rogue hex colors remain
- You have verified by reading thumbnails after the final assembly

**Maximum harmonization iterations:** 3. If inconsistencies persist after 3 rounds, document them and proceed to delivery.

### Step 6: Final QA + Deliver

Run the full QA from [QA (Required)](#qa-required): read every thumbnail, 5-pass visual inspection, score all 6 dimensions with evidence, complete the Delivery Attestation.

### When NOT to Use Sub-Agents

- **1-2 slides only**: Create them sequentially in the main agent (spawning overhead not worth it)
- That's it. **3+ slides = sub-agents, always.**

### Worked Example: 7-Slide Cloud Migration Deck

**User request**: "Create a presentation on cloud migration strategy for enterprise clients"

**Step 1 — Plan:**

Deck context: Title="Cloud Migration Strategy", Audience="Enterprise CTO/CIO", Tone="Consultative/strategic", Brand="default"

| # | Name | Category | Content | Example HTML |
|---|------|----------|---------|-------------|
| 1 | cover | STRUCTURE | Title: "Cloud Migration Strategy" | structure-cover/document-cover.html |
| 2 | executive-summary | STRUCTURE | Key findings + recommendations | structure-summary/executive-summary.html |
| 3 | market-overview | DATA | Market size trend chart | data-trend/line-chart.html |
| 4 | migration-framework | EXPLAIN | 4-pillar framework | explain-metaphor/pillars.html |
| 5 | comparison | COMPARE | On-prem vs cloud cost | compare-table/feature-comparison.html |
| 6 | timeline | FLOW | 12-month migration | flow-timeline/horizontal-timeline.html |
| 7 | next-steps | STRUCTURE | Action items + owners | structure-next-steps/action-list.html |

**Steps 1b-6**:
- **Step 1b**: Bash(preflight + mkdir + prompts dir), write 6 prompt files — ONE message
- **Step 2**: Bash(run_in_background=true) × 6 → claude -p for slides 1, 3, 4, 5, 6, 7 — ALL in ONE message, true parallel
- **Step 3**: TaskOutput for each task_id, verify 6 HTML + PPTX files exist with score ≥ 8.5
- **Step 3b**: YOU (the orchestrator) create the executive summary slide directly — read executive-summary-task.md, synthesize all slides, follow creation pipeline
- **Step 4-6**: Assemble → Harmonize → Final QA + Deliver

---

## Reading and Analyzing Content

**Text extraction**: `python -m markitdown path-to-file.pptx`

**Raw XML access**: `python ooxml/scripts/unpack.py <office_file> <output_dir>`

Key files: `ppt/presentation.xml` (metadata), `ppt/slides/slide{N}.xml` (content), `ppt/notesSlides/notesSlide{N}.xml` (notes), `ppt/theme/theme1.xml` (colors/fonts), `ppt/media/` (images).

---

## Editing an Existing Presentation

Work with raw Office Open XML (OOXML): unpack .pptx, edit XML, repack.

### Workflow
1. **MANDATORY — READ ENTIRE FILE**: Read [`ooxml.md`](ooxml.md) completely. **NEVER set any range limits.**
2. Unpack: `python ooxml/scripts/unpack.py <office_file> <output_dir>`
3. Edit XML files (primarily `ppt/slides/slide{N}.xml`)
4. **CRITICAL**: Validate after each edit: `python ooxml/scripts/validate.py <dir> --original <file>`
5. Pack: `python ooxml/scripts/pack.py <input_directory> <office_file>`

---

## Single-Slide Workflow (1-2 Slides Only)

> **This section is for 1-2 slide requests ONLY.** If the request has 3+ slides, STOP — go to [Multi-Slide Presentations](#multi-slide-presentations-sub-agent-parallelization). You are the ORCHESTRATOR, not the slide author.

### Before Starting — Read These First

1. **[`preflight-checklist.md`](preflight-checklist.md)** — Template selection + content limits (MANDATORY)
2. **[`slide-selection-guide.md`](slide-selection-guide.md)** — 120-template index
3. **[`COMMON_FAILURES.md`](COMMON_FAILURES.md)** — Avoid common production mistakes
4. **[`slide_standardisation.md`](slide_standardisation.md)** — Reusable HTML patterns (title zone, container box, takeaway box, typography, footer)

### Execution Sequence (MANDATORY — 10 Steps, 3 Gates)

Every slide follows this sequence. **Do not skip steps.** Gates are blocking.

| # | Step | Action | Gate |
|---|------|--------|------|
| 1 | **DEPENDENCIES** | `bash scripts/preflight_check.sh` | All checks pass |
| 1b | **SLIDE COUNT CHECK** | Count the slides in the request. If 3+: STOP — go to [Multi-Slide Presentations](#multi-slide-presentations-sub-agent-parallelization). Do NOT proceed to step 2. You are the ORCHESTRATOR — you plan the deck and call the Task tool. You do NOT write HTML yourself. | **If 3+ slides: MUST use sub-agents. Proceeding to step 2 without sub-agents = PROHIBITED.** |
| 2 | **SELECT TEMPLATE** | Read `slide-selection-guide.md` §1-§2. For multi-slide: verify deck has COVER + EXEC SUMMARY + BODY + NEXT STEPS + CLOSING (§2A). For EACH slide: look up the example HTML path → **read the full example HTML file**. | **Every example HTML file read completely** AND deck structure verified |
| 3 | **READ TECHNICAL REF** | Read [`html2pptx.md`](html2pptx.md) completely. **NEVER set range limits.** | — |
| 3b | **ESTIMATE HEIGHT** | For each slide: estimate total content height using the formula in `preflight-checklist.md` §4. For split layouts, estimate PER-PANEL. Formula: charts × height + bullets × 18pt + tables × 20pt/row + padding + gaps. | **GATE: Total ≤ 325pt (single-line title) or ≤ 302pt (two-line). Per-panel ≤ panel height. If over → reduce content or change layout BEFORE writing HTML.** |
| 4 | **AUTHOR HTML** | Adapt the example template. Use `class="brand-slide"`, `data-echarts`, three-zone layout. Follow `slide_standardisation.md` patterns. | HTML file created |
| 5 | **PRE-VALIDATE (AUTOMATIC)** | Built into CLI. ERRORS are BLOCKING. CLI shows top 5 errors + TodoWrite call + attempt counter. Execute the TodoWrite call, fix top 5, re-run. `--skip-validation` only after CLI shows `[5 attempts — qualifies]` on the error. See [Validation Failure Protocol](#validation-failure-protocol-mandatory-when-errors-are-reported). | **GATE 1: Zero ERRORS** |
| 6 | **GENERATE** | `node scripts/html2pptx-cli.mjs workspace/slide1.html ... -o output/presentation.pptx` | PPTX file exists |
| 7 | **THUMBNAILS (AUTOMATIC)** | Built into CLI — generates per-slide thumbnails + overview grid automatically. | PNG exists |
| 8 | **INSPECT (VISUAL)** | Use the **Read tool** to open EACH slide thumbnail PNG. The CLI prints absolute paths prefixed with `▸ READ:` — use these paths directly. Run the 5-pass comparison from `postflight-checklist.md` §5 (Element Inventory → Position → Style → Spatial → Data). Record findings per pass. **If you did not Read every thumbnail PNG, you have NOT completed visual inspection.** | **GATE 2: All 5 passes completed, zero BLOCKING/MAJOR findings** |
| 9 | **SELF-SCORE** | Score across [6 dimensions](#self-score-quality-gate). Write EVIDENCE before each score. BLOCKING issues cap total at 6. MAJOR issues cap at 7. | **GATE 3: Weighted ≥ 8.5, all dims ≥ 7** |
| 10 | **ITERATE or DELIVER** | Score < 8.5 or any dim < 7? → Fix HTML → go to step 5 → **re-read thumbnails at step 8** (every iteration). Score ≥ 8.5 AND zero BLOCKING/MAJOR? → [Delivery Attestation](#delivery-attestation). | Zero BLOCKING/MAJOR issues, score ≥ 8.5 |

**Step 2 is the most-skipped step.** IF YOU WROTE HTML WITHOUT READING AN EXAMPLE FILE, DELETE IT AND START OVER.

> **CONTENT HEIGHT ESTIMATION**: Before writing HTML, estimate content height per PANEL (not just per slide). For a 65:35 split, the right panel is only ~250pt wide × ~325pt tall. 4 items with descriptions ≈ 4 × 60pt = 240pt — barely fits. 5 items = will overflow. If estimated content > 80% of panel height, reduce items or change the split ratio BEFORE coding.

> **MULTI-SLIDE DECKS (3+ slides): You MUST spawn parallel sub-agents via background CLI processes.** Do NOT write body slide HTML yourself. Do NOT use the Task tool (it blocks). Spawn `claude -p` via `Bash(run_in_background=true)` — all in ONE message. You create ONLY the executive summary yourself. See [How to Spawn Parallel Sub-Agents](#how-to-spawn-parallel-sub-agents--background-cli-mandatory-for-3-slides).

### Multi-Slide Deck Structure (MANDATORY)

When creating 2+ slides, the deck MUST follow this structure from `slide-selection-guide.md` §2A:

| Position | Role | Example HTML to READ |
|----------|------|---------------------|
| Slide 1 | COVER | Read `examples/structure-cover/document-cover.html` |
| Slide 2 | EXEC SUMMARY | Read `examples/structure-summary/executive-summary.html` (or `dashboard.html` / `key-takeaways.html`) |
| Slides 3-N | BODY | Read the example HTML for each slide's category (DATA, COMPARE, NARRATIVE, EXPLAIN, FLOW) |
| Slide N+1 | NEXT STEPS | Read `examples/structure-next-steps/action-list.html` (or `recommendation-table.html`) |
| Last slide | CLOSING | Read `examples/structure-context/closing.html` |

**Every deck needs a COVER slide and an ending slide.** A deck with only body content slides is incomplete.

**For EACH slide**: look up its example HTML path in `slide-selection-guide.md`, then **read the full example HTML file** before writing your own. This applies to structural slides too — covers, executive summaries, and closing slides have specific HTML patterns.

Read `slide-selection-guide.md` §2A-§2D for full presentation architecture rules including section dividers, slide count heuristics, and archetype sequences.

### Template Reading Protocol (MANDATORY per slide)

For EVERY slide you create, you MUST:

1. **Look up** the correct template path from `slide-selection-guide.md` (e.g., `structure-cover/document-cover.html` for covers, `structure-summary/executive-summary.html` for executive summaries)
2. **Read the full example HTML file** from `examples/{path}` — not just the filename, the ENTIRE file content
3. **Study** its structure: layout zones, flex ratios, container patterns, typography tiers, footer format
4. **Adapt** the example to your content — change text and data, preserve structural patterns

**This applies to ALL slide types** including structural slides (covers, executive summaries, agendas, closing slides). Structural slides have specific HTML patterns that differ from data slides.

**If you write HTML without reading the example file first, DELETE IT AND START OVER.**

### Template Fidelity Rule (MANDATORY)

Your output must contain the SAME structural elements as the template — no more, no less.

- **"Adapt" means**: Change text, data, colors, labels. Adjust flex ratios if content demands it.
- **"Adapt" does NOT mean**: Add new sections, hero metrics, bullet lists, KPI cards, or decorative elements that aren't in the template.
- **Structural slides** (covers, closings, agendas) are DELIBERATELY minimal. A cover with only a title and date is CORRECT. Do NOT "improve" it by adding metrics, key findings, or summary bullets.
- **Self-test**: After writing HTML, list every structural element (sections, containers, charts, bullet lists, metric cards). Compare against the template. If you have MORE elements than the template, DELETE the extras.

### First Decision: What Type of Slide?

**Before reading technical documentation, determine your slide type.** This table maps content requests to the correct starting template:

| Content Type | Category | Start From This Example |
|--------------|----------|------------------------|
| Bar/line/pie chart + insights | DATA | `examples/data-ranking/bar-with-callouts.html` |
| KPI cards / metrics dashboard | DATA | `examples/data-performance/kpi-dashboard.html` |
| Feature comparison / scorecard | COMPARE | `examples/compare-table/feature-comparison.html` |
| Bullet points / key insights | NARRATIVE | `examples/narrative-text-insight/bullets-standard.html` |
| Title page / section divider | STRUCTURE | `examples/structure-cover/document-cover.html` |
| Timeline / milestones | FLOW | `examples/flow-timeline/horizontal-timeline.html` |
| Process steps / chevrons | FLOW | `examples/flow-step-by-step/chevron-steps.html` |
| Framework / pillars | EXPLAIN | `examples/explain-metaphor/pillars.html` |

Full 120-template index: [`slide-selection-guide.md`](slide-selection-guide.md)

**Decision rule:** If the user asks for a chart WITH any text (insights, observations, takeaways), ALWAYS use the Chart + Takeaway layout (65:35 split). Never vertically stack a chart above or below text.

### Quick Start Rules

1. **Lightweight HTML Mode**: Every slide MUST use `class="brand-slide"` on `<body>`. This auto-injects brand colors as CSS variables. Never write `:root` blocks or hardcode hex colors.

1b. **Slide type declaration**: Structural slides (covers, dividers, agendas, summaries, next-steps, closing) → add `data-slide-type="structural"` to `<body>`. This skips inapplicable validation checks. Body/data slides omit this attribute.

1c. **Layout pattern declaration**: Copy the `data-layout` attribute from the example template you're adapting (e.g., `data-layout="chart-with-insights"`). This tells the validator what structural elements your slide MUST contain. Always copy from the example — if you change the layout, update the attribute.

2. **ECharts for ALL charts**: Every chart MUST use `<div data-echarts='{ JSON config }'>`. Never build charts with HTML/CSS divs, tables, or SVG.

#### Color Protocol

1. **Identify the brand**: Company-specific → `branding/{company}.json` + `PPTX_BRAND={company}`. Generic → default applies automatically.
2. **In HTML/CSS**: Use `var(--brand-*)` variables. NEVER hardcode hex. Non-brand hex is auto-replaced with closest palette match.
3. **In ECharts JSON**: Omit color properties entirely (auto-coloring). `var(--brand-primary)` inside `data-echarts` renders as **BLACK** (no CSS in server-side rendering).

Full color system: [`branding/README.md`](branding/README.md)

### Common Mistakes (Avoid These)

| Mistake | Correct Approach |
|---------|-----------------|
| Building charts with HTML/CSS divs | Use `<div data-echarts='{ config }'>` — see `examples/` for 120 templates |
| Writing `:root { --mck-navy: #1E3A5F }` | Use `class="brand-slide"` on `<body>` (variables auto-injected) |
| Hardcoding hex colors in styles | Use `var(--brand-primary)` and other CSS variables |
| Using `var(--brand-*)` in `data-echarts` JSON | Omit colors to use auto-coloring, or use hex values from brand config |
| Structural slide triggers underfill/hierarchy errors | Add `data-slide-type="structural"` to `<body>` for covers, agendas, summaries, next-steps, closing |
| Building charts with HTML divs (colored bars/segments) | Use `<div data-echarts='{ config }'>` — HTML divs produce broken/invisible charts in PPTX |
| Chart slide with no insights panel | Add a callout container or takeaway box next to the chart — `chart-with-insights` requires it |
| Using `overflow: hidden` on text containers | NEVER — this clips text invisibly in PPTX. Instead: reduce font-size, shorten text, or increase container height |

**Validation errors**: See [`html2pptx.md`](html2pptx.md) → "Pill/Badge Pattern" section for full examples.

---

## QA (Required)

**Assume there are problems.** Every presentation must pass visual validation before delivery.

### Output Files Reference

| File | Charts Visible? | Use For |
|------|-----------------|---------|
| `output.pptx` | YES | The presentation |
| `output-slide-001.png` (PPTX thumbnail) | YES | **Per-slide visual QA — USE THIS** |
| `output-overview-grid.png` | YES | Multi-slide overview |
| `output-slide-001-html-preview.png` | NO (blank rectangles) | Quick layout check only |

### Console Review

Check generation output for: color replacement warnings, ECharts rendering errors, any error/warning messages. Address before proceeding.

### Visual Inspection (MANDATORY — Read Every Thumbnail)

**You MUST use the Read tool to open each slide thumbnail PNG.** Do NOT skip this. Do NOT rely solely on console output. The thumbnail is the ONLY way to verify what the slide actually looks like.

**WHICH THUMBNAILS TO READ**: The CLI produces two types of image per slide:
- `*-slide-NNN.png` (PPTX thumbnail) — shows the ACTUAL rendered slide with charts, colors, and data. **USE THIS for all visual QA.**
- `*-html-preview.png` (HTML screenshot) — shows layout only, charts are BLANK RECTANGLES. Use ONLY for quick layout checks during iteration.

**For final visual inspection and delivery QA, you MUST read `*-slide-NNN.png` files. Reading `*-html-preview.png` for final QA is INVALID** — you will miss all charts, data labels, and rendered ECharts content.

For each slide thumbnail, run the **5-pass comparison protocol** from [`postflight-checklist.md`](postflight-checklist.md) §5:

| Pass | Focus | What to Check |
|------|-------|--------------|
| 1 | **Element Inventory** | Count every visual element. Missing element = BLOCKING. Extra element = BLOCKING. |
| 2 | **Position & Alignment** | Check element positions, spacing, alignment. >10% deviation = BLOCKING. |
| 3 | **Style & Color** | Verify brand colors, fill treatments, borders, backgrounds. Non-brand color = BLOCKING. |
| 4 | **Spatial Relationships** | Verify connectors reach targets, boxes enclose content, gaps ≥ 8px. |
| 5 | **Data Fidelity** | Verify ALL text, data values, labels, axis scales match the intended content. |

**Record specific findings for each pass.** "Looks good" without specifics = INVALID. Zero findings across all 5 passes = you are not looking hard enough — re-examine.

After the 5-pass protocol, run the **adversarial self-checks** from `postflight-checklist.md` §6. These catch the issues you want to rationalize away.

**On every iteration** (not just the first): re-read the NEW thumbnail and re-run all 5 passes. Fixes can introduce new issues.

### Self-Score (Quality Gate)

Score across 6 dimensions (0-10 each). **Write EVIDENCE before each score** — cite specific elements, measurements, or validator output. "Looks good" is not evidence.

| Dimension | Weight | What to Check |
|-----------|--------|---------------|
| D1 Structural fidelity | 25% | Element count matches, shapes correct, containers accurate |
| D2 Content accuracy | 20% | All data values present, text correct, labels on chart |
| D3 Brand compliance | 20% | All colors from brand palette, no undefined vars |
| D4 Content density | 15% | 85-95% fill, per-panel ≥70% |
| D5 Typography | 10% | 4-tier system, max 4 sizes, bold-keyword pattern |
| D6 Visual polish | 10% | Aligned, balanced, professional appearance |

**Scoring rules:**
- **Evidence first**: For each dimension, write what you observed BEFORE assigning a number
- **Score caps**: Any BLOCKING issue → total capped at 6. Any MAJOR issue (no BLOCKING) → capped at 7
- **Anti-inflation**: For any dimension you score ≥ 8, state what prevents a 10. If you can't identify a gap, score it 10
- **Rescore from scratch**: On each iteration, rescore ALL dimensions by re-reading the thumbnail — do NOT carry forward previous scores

**Threshold**: Weighted score ≥ 8.5 AND all dimensions ≥ 7. If below, iterate.

### Fix and Re-verify

When validation reports errors, follow the [Validation Failure Protocol](#validation-failure-protocol-mandatory-when-errors-are-reported). The CLI will print a TodoWrite call — execute it immediately to track errors across context compaction.

Fix HTML → re-run from Step 5 (pre-validate → generate → thumbnails) → **re-read the new thumbnail PNG** → re-run all 5 visual passes → rescore all 6 dimensions from scratch. Repeat until score ≥ 8.5 with zero BLOCKING/MAJOR issues.

**Every iteration MUST include re-reading the thumbnail.** Do NOT assume a fix worked without visual verification. Fixes frequently introduce new issues (regressions).

**Typical iterations:** 3-5. **Maximum:** 10 per slide. **7+ iterations on the same issue**: Restructure the layout rather than patching. **10 iterations reached**: Deliver best version, document remaining issues.

---

## Validation Failure Protocol (MANDATORY when errors are reported)

When the CLI reports validation errors, follow this protocol.

#### Step 1: Execute the TodoWrite call printed by the CLI

The CLI prints a ready-to-use `TodoWrite(todos=[...])` call with the
top 5 highest-priority errors. **Copy and execute it immediately.**
This creates a persistent checklist that survives context compaction.

On subsequent runs, the CLI also shows a progress diff (Fixed/Remaining/New)
and an attempt counter per error (e.g., `[attempt 2/5]`). Use this to
update your TodoWrite: mark fixed errors `"completed"`, keep persistent
errors as `"in_progress"`, add new regression errors as `"pending"`.

#### Step 1b: Root-Cause Check (before fixing ANY error)

Before patching errors, classify each one:

| If... | Then the root cause is... | Fix by... |
|-------|---------------------------|-----------|
| A structural slide (cover, closing) has [TAKEAWAY], [BULLET], [HIERARCHY], or content overflow | **Wrong content for slide type** — you added elements that don't belong | REMOVE the excess content. Do NOT reformat it. |
| Content exceeds 325pt by >100pt (e.g., 478pt) | **Too much content for one slide** | SPLIT into two slides. Do NOT compress — shrinking 478pt into 325pt destroys readability. |
| 3+ errors on the same slide share a spatial area (e.g., all in the right panel) | **Design-level layout problem** — the panel is too small for its content | REDESIGN the layout (change split ratio, move content to a different panel, rearrange spatial positions). Do NOT patch each error individually. |
| A single isolated error on an otherwise clean slide | **Formatting error** | Fix with the Quick Fix Reference below. |

**Regression prevention**: When fixing an error, change ONLY the code related to that error. Do NOT modify unrelated CSS properties (flex-grow, flex ratios, min-height, padding on other containers). After each fix, verify that previously-working elements are unchanged.

#### Step 2: Fix the Top 5 Errors

The CLI shows only the 5 highest-priority errors, already sorted:
1. **STRUCTURAL**: [SKELETON], [PSEUDO], [NESTED-LIST], [FLEX-STACK]
2. **CONTENT**: [HIERARCHY], [CONTAINER], [TAKEAWAY], [BULLET], [BULLET-CONSISTENCY]
3. **OVERFLOW/DENSITY**: content height, underfill, [HORIZONTAL-FILL], [FLEX-OVERFLOW]
4. **STYLE**: [COLOR], [COLOR-MAP], [HARDCODED-HEX], [SEPARATOR], [STANDARD]
5. **LAYOUT-AWARE**: [CHART-METHOD], [CHART-INSIGHTS-PANEL], [TABLE-REQUIRED], [SVG-REQUIRED]

Fix ALL 5 in a single pass before re-running. Do NOT fix one at a time.

#### Step 3: Re-run and Repeat

Re-run the CLI. It will:
- Show a **progress diff** (Fixed/Remaining/New vs previous run)
- Show the **next top 5** errors (previous ones should be gone)
- Print a new **TodoWrite call** to execute
- Track **attempt counts** per error in `.validation-state.json`

Continue the fix → re-run → TodoWrite cycle. Typical: 2-3 cycles. Maximum: 5.

#### `--skip-validation` Conditions (ALL must be true)

`--skip-validation` is permitted ONLY when ALL of these are true:
1. **5+ attempts** on the same error (CLI shows `[5 attempts — qualifies for --skip-validation]`)
2. **Different approaches** tried each time (not retries of the same fix)
3. **All attempts documented** in TodoWrite
4. **Error is a confirmed false positive** — ALL of the following must be true:
   a. You have GENERATED the PPTX (not just validated the HTML)
   b. You have READ the PPTX thumbnail (`*-slide-NNN.png`, NOT `*-html-preview.png`)
   c. The specific element the error refers to LOOKS CORRECT in the thumbnail
   d. You can state: "Error [X] on [element] is a false positive because the thumbnail shows [specific observation]"
   e. If you cannot complete steps a-d, the error is NOT confirmed as a false positive — keep fixing it
5. **All other errors are fixed** — you are NOT skipping errors you haven't tried to fix

There is no user to ask — you must resolve errors yourself or meet all 5 conditions above.

#### Quick Fix Reference

| Error Tag | Most Common Fix |
|-----------|----------------|
| Content height overflow (>325pt) | Reduce fonts, tighten spacing, reduce content, split into 2 slides |
| Content height underfill (<70%) | Increase fonts to 14-16px, increase chart height to 280pt+, add padding |
| [HIERARCHY] body > header | Reduce body font-size below header (Header=T2 11-14px, Body=T3 9-11px) |
| Typography >4 tiers | Consolidate similar sizes (e.g., 13/12/11 → 12px) into 4-tier system |
| [CONTAINER] no Container Box | Wrap panel in border + header bar div |
| [FLEX-STACK] flex:1 squeeze | Add min-height to text sibling, or remove flex:1 and use explicit heights |
| [FLEX-OVERFLOW] | Reduce font-size by 1-2px, shorten text, reduce padding |
| [BULLET] missing markers | Add `&#9632;` marker span or use list-style: disc |
| [SEPARATOR] too thick/dark | Change to `1px dashed var(--brand-gray-medium)` |
| [HARDCODED-HEX] | Replace hex with `var(--brand-*)` token |
| [CHART-METHOD] no ECharts | Replace HTML div chart with `<div data-echarts='...'>` |
| [CHART-INSIGHTS-PANEL] | Add text/callout panel beside chart in a flex-row |

---

## Delivery Attestation (REQUIRED)

Before delivering, state:
> "I have completed visual validation of all [N] slides. For each slide I: (1) read the thumbnail PNG using the Read tool, (2) ran the 5-pass comparison protocol, (3) ran adversarial self-checks, (4) scored all 6 dimensions with evidence. Final weighted score: [X]. Issues found and resolved: [list or 'none']. The presentation is ready for delivery."

**Delivery without reading every thumbnail PNG is PROHIBITED.** If you cannot state which specific elements you verified in each thumbnail, you did not perform visual validation.
