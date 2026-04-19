# Claude Code Prompt — The Perfect Match: Full Refactor + Quotas Feature

## Context

You are working on **The Perfect Match**, a Tauri (Rust + React/TypeScript) desktop
app that assigns students to oral exam slots ("colles") fetched from bjcolle.fr using
the Hungarian algorithm.

The original codebase has several hardcoded problems:
- Subject names ("Mathématiques", "Physique") and a teacher name ("M. MOULIN") are
  scattered as string literals throughout `assignment.rs`
- The pipeline is always two passes (Math then Physics), never configurable
- Slot fetching is week-by-week with no date range UI
- All scoring weights are compile-time constants
- `Student` struct is defined twice in two different files
- `compute_assignment` blocks the async Tokio runtime (missing `spawn_blocking`)
- TypeScript types don't match Rust types (`StudentWithCounts.student` is typed as
  `string` but the Rust struct contains a full `Student`)

## Your task

Implement the complete refactor described below. You have **reference implementations**
for every file — use them as your specification. Do not deviate from the data model or
API signatures, as the frontend and backend are tightly coupled.

---

## Step 1 — Read the reference files first

Before writing any code, read these reference files in their entirety. They are your
ground truth:

```
src-tauri/src/types.rs        ← data model (READ THIS FIRST)
src-tauri/src/assignment.rs   ← algorithm
src-tauri/src/store.rs        ← persistence
src-tauri/src/lib.rs          ← Tauri commands
src-tauri/src/future_colles.rs
src-tauri/src/past_colles.rs
src-tauri/src/students.rs
src-tauri/src/session.rs
src-tauri/src/auth.rs
src/types/index.ts
src/lib/utils.ts
src/lib/export.tsx
src/components/slot-rule-editor.tsx
src/components/weights-editor.tsx
src/components/quota-manager.tsx
src/components/quota-tracker.tsx
src/components/step-manager.tsx
src/components/restriction-manager.tsx
src/components/group-manager.tsx
src/components/steps/step-0-students.tsx
src/components/steps/step-1-past-colles.tsx
src/components/steps/step-2-fetch-slots.tsx
src/components/steps/step-3-pipeline.tsx
src/components/steps/step-4-compute.tsx
src/components/steps/step-5-publish.tsx
```

These files are provided alongside this prompt. Treat them as the **exact target
state** — your job is to write them into the actual project, resolve any compilation
errors, and make `cargo tauri dev` succeed.

---

## Step 2 — Files to keep unchanged

Do NOT modify these files. They work correctly and must be preserved:

```
src-tauri/src/create_colle.rs
src-tauri/src/main.rs
src/components/loading-button.tsx
src/components/login-form.tsx
src/components/step-progress.tsx
src/components/student-combobox.tsx
src/components/student-list.tsx
src/components/ui/          (entire directory)
src/App.tsx
src/main.tsx
tauri.conf.json
Cargo.toml                  (you may add crates if needed, but check existing deps first)
package.json
```

---

## Step 3 — Files to delete

```
src/components/steps/step-3-assignment.tsx   ← replaced by step-3-pipeline.tsx
src/components/steps/step-4-publish.tsx      ← replaced by step-5-publish.tsx
```

---

## Step 4 — What you are implementing

### Architecture overview

The entire app is refactored around a **generic N-pass assignment pipeline**. Every
policy decision (which subject, which group, what capacity, what weights) is now
runtime data rather than hardcoded logic.

### Rust data model (`src-tauri/src/types.rs`)

This is the single source of truth. Key new types:

**`AssignmentPass`** — one pipeline pass:
- `slot_subject_filter: String` — substring match on `Slot.subject` (empty = all)
- `student_group_id: Option<String>` — null means all students
- `weights: Option<Weights>` — per-pass override; null falls back to global
- `slot_rules: Vec<SlotRule>` — pass-level capacity/ignore rules
- `ignored_slot_ids: Vec<String>` — manually excluded slots for this pass
- `ignored_student_ids: Vec<String>` — manually excluded students for this pass
- `priority: u32` — execution order (0 = first)

**`SlotRule`** — replaces all hardcoded teacher/subject checks:
- `match_teacher: Option<String>` — exact match; None = match any
- `match_subject: Option<String>` — substring match; None = match any
- `action: SlotAction` — either `SetCapacity(usize)` or `Ignore`

**`SubjectQuota`** — per-subject colle limit:
- `subject_filter: String` — substring match on slot subject (empty = all subjects)
- `max_colles: u32` — maximum assignments per student
- `group_id: Option<String>` — scope to a group, or None for all students

**`ComputeResult`** — now includes:
- `quota_violations: Vec<QuotaViolation>` — students who exceeded a quota
- `quota_progress: Vec<StudentQuotaProgress>` — full cross-table for the tracker UI

### Algorithm (`src-tauri/src/assignment.rs`)

Key points to implement correctly:

1. `slot_is_ignored()` checks pass-level rules first, then global rules (first match
   wins). Manual `ignored_slot_ids` are checked before any rules.

2. `effective_capacity()` returns `DEFAULT_SLOT_CAPACITY` (3) if no rule matches.

3. `run_pipeline()` sorts passes by `priority`, runs them sequentially. After each
   pass, `generate_time_blocks()` converts assignments into `Restriction` objects that
   are accumulated and passed to subsequent passes, preventing double-booking.

4. `evaluate_quotas()` runs AFTER all passes complete. It counts assignments per
   student per quota (filtering by `subject_filter`) and emits `QuotaViolation` and
   `StudentQuotaProgress` entries. Quotas are **soft warnings only** — they never
   block the algorithm.

5. `compute_best_pipeline()` runs the full pipeline N times in parallel using Rayon's
   `par_iter`, picks the result with the lowest total score.

6. In `lib.rs`, `compute_assignment` is `async` and wraps the CPU work in
   `tokio::task::spawn_blocking` to avoid blocking the Tauri async runtime.

### Slot fetching (`src-tauri/src/future_colles.rs`)

`fetch_future_colles` now accepts `start_date: String` and `end_date: String`
(YYYY-MM-DD format). Internally:
- `mondays_in_range()` generates all Monday dates between start and end
- For each Monday, find the BJColle dashboard page for that week
- Scrape slots from that page
- Deduplicate by `slot.id` across all weeks
- `Slot.is_assigned` is always `false` for now (marked TODO)

### Storage (`src-tauri/src/store.rs`)

New CRUD commands to implement:
```rust
add_subject_quota(app, quota) -> Result<SubjectQuota, String>
update_subject_quota(app, quota) -> Result<SubjectQuota, String>
delete_subject_quota(app, id) -> Result<(), String>
load_subject_quotas(app) -> Result<Vec<SubjectQuota>, String>

add_assignment_pass(app, pass) -> Result<AssignmentPass, String>
update_assignment_pass(app, pass) -> Result<AssignmentPass, String>
delete_assignment_pass(app, id) -> Result<(), String>
load_assignment_passes(app) -> Result<Vec<AssignmentPass>, String>
reorder_assignment_passes(app, ordered_ids) -> Result<(), String>

add_slot_rule(app, rule) -> Result<SlotRule, String>
update_slot_rule(app, rule) -> Result<SlotRule, String>
delete_slot_rule(app, id) -> Result<(), String>
load_slot_rules(app) -> Result<Vec<SlotRule>, String>

save_global_weights(app, weights) -> Result<(), String>
load_global_weights(app) -> Result<Weights, String>
```

All commands read/write from a single `data.json` via `load_data`/`save_data`.
`AppData::default()` must handle a missing or empty file gracefully.

### Tauri command registry (`src-tauri/src/lib.rs`)

`compute_assignment` signature:
```rust
async fn compute_assignment(
    students: Vec<Student>,
    slots: Vec<Slot>,
    restrictions: Vec<Restriction>,
    past_colles: Vec<PastColle>,
    colles_count: CollesCount,
    global_rules: Vec<SlotRule>,
    global_weights: Weights,
    passes: Vec<AssignmentPass>,
    groups: Vec<Group>,
    quotas: Vec<SubjectQuota>,
    n: usize,
) -> Result<ComputeResult, String>
```

All 4 new quota commands must be registered in `tauri::generate_handler![]`.

### Frontend step flow

The app now has **6 steps** (was 5):

| Step | Component | What it does |
|------|-----------|--------------|
| 0 | `step-0-students.tsx` | Load students, manage restrictions & groups |
| 1 | `step-1-past-colles.tsx` | Fetch past 2 weeks of colle history |
| 2 | `step-2-fetch-slots.tsx` | **NEW** Date range picker + slot include/exclude |
| 3 | `step-3-pipeline.tsx` | **NEW** Pipeline builder: passes, global rules, weights, quotas |
| 4 | `step-4-compute.tsx` | **NEW** Run computation, per-pass results, quota tracker |
| 5 | `step-5-publish.tsx` | Publish to BJColle |

### Step 2 — Slot picker (`step-2-fetch-slots.tsx`)

- Two date inputs (start, end)
- On fetch: calls `invoke('fetch_future_colles', { startDate, endDate, cookie })`
- Results grouped by `slot.subject`
- Each subject has a group-level checkbox (check/uncheck all in that subject)
- Each slot has an individual checkbox
- "Include all" / "Exclude all" buttons
- On continue: saves active slots to `localStorage` via `saveCache('future_slots', activeSlots)`
- Also saves `page_url` from the response to `saveCache('future_slots_url', url)`

### Step 3 — Pipeline builder (`step-3-pipeline.tsx`)

Three top-level tabs: **Passes**, **Règles globales & Poids**, **Quotas**

**Passes tab:**
- Each pass is a collapsible card with 4 inner tabs: Général, Règles créneaux, Poids,
  Exclure
- Cards can be reordered with up/down arrow buttons; order is persisted via
  `reorder_assignment_passes`
- **Général**: name input, subject filter input with `<datalist>` autocomplete,
  group selector showing student counts
- **Règles créneaux**: `<SlotRuleEditor>` component (pass-level rules)
- **Poids**: checkbox to enable custom weights, then `<WeightsEditor>` if enabled
- **Exclure**: scrollable checklist of matching slots + scrollable checklist of
  students; checked = included, unchecked = ignored

**Règles globales & Poids tab:** nested tabs for global `<SlotRuleEditor>` and global
`<WeightsEditor>`

**Quotas tab:** `<QuotaManager>` component

On "Continuer": caches `assignment_passes`, `global_slot_rules`, `global_weights`,
`subject_quotas` to localStorage.

### Step 4 — Compute + results (`step-4-compute.tsx`)

- Loads everything from localStorage cache + backend
- Pre-flight summary: lists configured passes with slot count and group badges; lists
  active quota badges
- Runs `invoke('compute_assignment', { ..., quotas })` — must include `quotas`
- Result summary: **4 stat tiles** — Assignés (green), Non assignés (red if > 0),
  Quotas dépassés (amber if > 0, else muted "Quotas OK"), Temps (purple)
- Per-pass result cards: expand when there are unassigned students; show unassigned
  student names as red badges; include a per-pass Excel download button
- **Quota tracker section** shown when `quotas.length > 0 && result.quota_progress.length > 0`

### `<SlotRuleEditor>` (`slot-rule-editor.tsx`)

Reusable component. Props: `rules`, `onChange`, `knownTeachers?`, `knownSubjects?`

- Lists existing rules with condition badges and action badge
- "Ajouter une règle" button opens inline form
- Form fields: name, `match_teacher` (exact, with datalist), `match_subject` (substring,
  with datalist), action type (SetCapacity or Ignore), capacity number input if SetCapacity
- Edit and delete buttons per rule

### `<WeightsEditor>` (`weights-editor.tsx`)

Reusable component. Props: `weights`, `onChange`

Renders all 5 weight fields as labeled number inputs with descriptions, plus a
"Réinitialiser" button that restores `DEFAULT_WEIGHTS`.

### `<QuotaManager>` (`quota-manager.tsx`)

Props: `quotas`, `setQuotas`, `groups`, `knownSubjects?`

CRUD list. Each quota shows: name, max badge, subject filter badge, group badge.
Form fields: name, subject_filter (with datalist), max_colles (number), group_id
(select with "Tous les élèves" default).

Calls `invoke('add_subject_quota')`, `invoke('update_subject_quota')`,
`invoke('delete_subject_quota')`.

### `<QuotaTracker>` (`quota-tracker.tsx`)

Props: `progress`, `violations`, `students`, `quotas`, `groups`

Two view modes toggled by buttons:

**By-quota mode**: one table per quota. Columns: Élève, progress bar, "X / max", status
badge. Progress bar colors: amber if violated, green if exactly at max, primary blue
otherwise. Status badges: "⚠ Dépassé" (destructive), "✓ Complet" (green), "N restante(s)"
(outline muted).

**By-student mode**: cross-table. Rows = students, columns = quotas. Each cell shows
"count/max" in a tiny font + a 1.5px-tall colored progress bar. Sticky first column
for student name.

Violation banner at top: amber background, lists each violation as
"Student name — Quota name : count / max". Green banner if no violations.

---

## Step 5 — TypeScript types (`src/types/index.ts`)

The TypeScript types must mirror the Rust types exactly. Key additions:

```typescript
export type SlotAction =
  | { type: 'SetCapacity'; value: number }
  | { type: 'Ignore' }

export interface SubjectQuota {
  id: string
  name: string
  subject_filter: string
  max_colles: number
  group_id: string | null
}

export interface QuotaViolation {
  quota_id: string; quota_name: string; student_id: string
  subject_filter: string; assigned_count: number; max_colles: number
}

export interface StudentQuotaProgress {
  student_id: string; quota_id: string; quota_name: string
  subject_filter: string; assigned_count: number; max_colles: number
}

export interface ComputeResult {
  passes: PassResult[]
  quota_violations: QuotaViolation[]
  quota_progress: StudentQuotaProgress[]
}

export const DEFAULT_WEIGHTS: Weights = {
  last_week_penalty: 6_000_000,
  same_day_penalty: 3_000,
  total_colles_weight: 50,
  restriction_penalty: 12_000_000,
  restriction_margin_minutes: 31,
}
```

---

## Step 6 — Cache helpers (`src/lib/utils.ts`)

Ensure these cache helpers exist and are used consistently:

```typescript
const SESSION_KEY = 'bjcolle_session'
export function saveSession(session: string): void
export function loadSession(): string        // returns '' if missing
export function clearSession(): void

const CACHE_PREFIX = 'bjcolle_cache_'
export function saveCache<T>(key: string, data: T): void
export function loadCache<T>(key: string): T | null
export function clearCache(key: string): void

// Timezone-safe: parse as local midnight, NOT UTC
export function getDayOfWeek(dateStr: string): string
// Returns YYYY/MM/DD one week before input
export function getWeekBefore(dateStr: string): string
```

---

## Step 7 — Verification checklist

After implementing, verify:

- [ ] `cargo build` completes with no errors in `src-tauri/`
- [ ] No `unwrap()` on `Option` without a prior `is_some()` / `if let` check
- [ ] `compute_assignment` in `lib.rs` uses `tokio::task::spawn_blocking`
- [ ] `AppData::default()` works when `data.json` doesn't exist yet
- [ ] All new Tauri commands are listed in `tauri::generate_handler![]`
- [ ] `mod types;` is declared in `lib.rs`
- [ ] `step-manager.tsx` imports and renders all 6 steps (0 through 5)
- [ ] `step-4-compute.tsx` passes `quotas` to `invoke('compute_assignment', ...)`
- [ ] `step-4-compute.tsx` renders `<QuotaTracker>` only when
      `quotas.length > 0 && result.quota_progress.length > 0`
- [ ] `step-3-pipeline.tsx` top-level `<TabsList>` has `grid-cols-3` (not 2)
- [ ] TypeScript compiles with `tsc --noEmit` (or `npm run build`) without errors
- [ ] `localStorage` is never used directly — always go through `saveCache`/`loadCache`
- [ ] No `@ts-ignore` or `@ts-expect-error` comments in new code

---

## Step 8 — Known TODOs to leave in place (do NOT implement)

These are explicitly deferred — add a `// TODO:` comment where relevant but do not
implement:

1. **`Slot.is_assigned`** — always set to `false`. The HTML parsing for assigned vs
   unassigned slots on bjcolle.fr is not yet known.
2. **Per-pass discipline ID** — `step-4-compute.tsx` currently fetches `disc=1` for
   all passes. The correct fix (per-pass `discipline_id` field) is deferred.
3. **Bulk slot-rule save** — currently rules are managed individually per CRUD op.
   A future `save_all_slot_rules(rules)` bulk command would reduce round-trips.

---

## Important implementation notes

- **Rust:** Use `pathfinding::kuhn_munkres::kuhn_munkres_min` for the Hungarian
  algorithm (already a dependency). Use `rayon::prelude::*` for parallel pipeline runs.
  Use `chrono::NaiveDate` for date math.

- **Serde:** `SlotAction` uses `#[serde(tag = "type", content = "value")]` — this is
  required for the TypeScript discriminated union `{ type: 'SetCapacity'; value: number }
  | { type: 'Ignore' }` to work correctly.

- **React:** No `<form>` tags — use `onClick`/`onChange` handlers. All state management
  via `useState`. No `localStorage` accessed directly — always use `saveCache`/`loadCache`.

- **Styling:** Tailwind only. No custom CSS. Use shadcn/ui components from `@/components/ui/`.

- **Data flow:** Steps communicate via localStorage cache keys:
  - `future_slots` — `Slot[]` (written by step 2, read by steps 3, 4)
  - `future_slots_url` — `string` (written by step 2, read by step 5)
  - `assignment_passes` — `AssignmentPass[]` (written by step 3, read by step 4)
  - `global_slot_rules` — `SlotRule[]` (written by step 3, read by step 4)
  - `global_weights` — `Weights` (written by step 3, read by step 4)
  - `subject_quotas` — `SubjectQuota[]` (written by step 3, read by step 4)
  - `last_week` — `PastColle[]` (written by step 1, read by step 4)
  - `colles_to_publish` — `ColleToPublish[]` (written by step 4, read by step 5)