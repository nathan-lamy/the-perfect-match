import { useState } from "react";
import { useStore } from "@/lib/store";
import { Panel, StageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  GripVertical,
  ListOrdered,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssignmentPass, Weights } from "@/lib/types";
import { DEFAULT_WEIGHTS } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const WEIGHT_FIELDS: { key: keyof Weights; label: string; hint: string }[] = [
  {
    key: "last_week_penalty",
    label: "Last week",
    hint: "Penalty for repeating last week's teacher",
  },
  {
    key: "same_day_penalty",
    label: "Same day",
    hint: "Penalty for two colles same day",
  },
  {
    key: "total_colles_weight",
    label: "History",
    hint: "Per past colle with this teacher",
  },
  {
    key: "restriction_penalty",
    label: "Restriction",
    hint: "Forbidden slot score",
  },
  {
    key: "restriction_margin_minutes",
    label: "Margin (min)",
    hint: "Buffer around restrictions",
  },
];

export function PassesStage() {
  const { state, setState, globalWeights, setGlobalWeights } = useStore();
  const [expanded, setExpanded] = useState<string | null>(
    state.passes[0]?.id ?? null,
  );

  const sorted = [...state.passes].sort((a, b) => a.priority - b.priority);

  const updatePass = (id: string, patch: Partial<AssignmentPass>) =>
    setState((s) => ({
      passes: s.passes.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));

  const addPass = () => {
    const id = `p_${Date.now()}`;
    const max = state.passes.reduce((m, p) => Math.max(m, p.priority), 0);
    setState((s) => ({
      passes: [
        ...s.passes,
        {
          id,
          name: "New pass",
          priority: max + 1,
          slot_subject_filter: "",
          student_group_id: null,
          weights: null,
          slot_rules: [],
          ignored_slot_ids: [],
          ignored_students: [],
        },
      ],
    }));
    setExpanded(id);
  };

  const remove = (id: string) =>
    setState((s) => ({ passes: s.passes.filter((p) => p.id !== id) }));

  const move = (id: string, dir: -1 | 1) => {
    const ordered = [...sorted];
    const idx = ordered.findIndex((p) => p.id === id);
    const target = idx + dir;
    if (target < 0 || target >= ordered.length) return;
    [ordered[idx], ordered[target]] = [ordered[target], ordered[idx]];
    ordered.forEach((p, i) => (p.priority = i + 1));
    setState({ passes: ordered });
  };

  return (
    <div>
      <StageHeader
        eyebrow="07 · Pipeline"
        title="Assignment passes"
        description="Each pass solves an independent assignment. Earlier passes lock their students' time slots."
        actions={
          <Button onClick={addPass}>
            <Plus className="mr-2 h-4 w-4" /> Add pass
          </Button>
        }
      />

      <Panel title="Global scoring weights" className="mb-6 p-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {WEIGHT_FIELDS.map((f) => (
            <div key={f.key}>
              <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {f.label}
              </Label>
              <Input
                type="number"
                value={globalWeights[f.key]}
                onChange={(e) =>
                  setGlobalWeights({
                    ...globalWeights,
                    [f.key]: Number(e.target.value),
                  })
                }
                className="mt-1 bg-surface font-mono text-sm"
              />
              <div className="mt-1 text-[10px] text-muted-foreground">
                {f.hint}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="space-y-3">
        {sorted.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-surface/40 p-8 text-center text-sm text-muted-foreground">
            <ListOrdered className="mx-auto mb-2 h-6 w-6" /> No passes yet.
          </div>
        )}
        {sorted.map((p, idx) => {
          const open = expanded === p.id;
          return (
            <Panel key={p.id} className={cn(open && "ring-1 ring-primary/30")}>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex flex-col items-center gap-0.5 text-muted-foreground">
                  <button
                    onClick={() => move(p.id, -1)}
                    disabled={idx === 0}
                    className="disabled:opacity-30 hover:text-foreground"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <GripVertical className="h-3 w-3 opacity-50" />
                  <button
                    onClick={() => move(p.id, 1)}
                    disabled={idx === sorted.length - 1}
                    className="disabled:opacity-30 hover:text-foreground"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>
                <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 font-mono text-xs text-primary">
                  {String(p.priority).padStart(2, "0")}
                </div>
                <button
                  onClick={() => setExpanded(open ? null : p.id)}
                  className="flex flex-1 items-center gap-2 text-left"
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="font-mono text-[11px] text-muted-foreground mt-1">
                    {
                      state.fetchedSlots.filter(
                        (s) =>
                          s.subject.includes(p.slot_subject_filter) &&
                          !p.ignored_slot_ids.includes(s.id),
                      ).length
                    }{" "}
                    slots ·{" "}
                    {
                      state.students.filter(
                        (s) =>
                          (state.groups
                            .find((g) => g.id === p.student_group_id)
                            ?.students.includes(s.name) ??
                            true) &&
                          !p.ignored_students.includes(s.name),
                      ).length
                    }{" "}
                    students
                  </span>
                  {p.weights && (
                    <span className="rounded bg-warning/10 px-1.5 py-0.5 font-mono text-[10px] uppercase text-warning">
                      custom weights
                    </span>
                  )}
                  <ChevronRight
                    className={cn(
                      "ml-auto h-4 w-4 text-muted-foreground transition-transform",
                      open && "rotate-90",
                    )}
                  />
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(p.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {open && (
                <div className="space-y-5 border-t border-border/60 p-5">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        Name
                      </Label>
                      <Input
                        value={p.name}
                        onChange={(e) =>
                          updatePass(p.id, { name: e.target.value })
                        }
                        className="mt-1 bg-surface"
                      />
                    </div>
                    <div>
                      <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        Subject filter (substring)
                      </Label>
                      <Input
                        value={p.slot_subject_filter}
                        onChange={(e) =>
                          updatePass(p.id, {
                            slot_subject_filter: e.target.value,
                          })
                        }
                        className="mt-1 bg-surface"
                        placeholder="Mathématiques"
                      />
                    </div>
                    <div>
                      <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        Student group
                      </Label>
                      <Select
                        value={p.student_group_id ?? "__all"}
                        onValueChange={(v) =>
                          updatePass(p.id, {
                            student_group_id: v === "__all" ? null : v,
                          })
                        }
                      >
                        <SelectTrigger className="mt-1 bg-surface">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all">All students</SelectItem>
                          {state.groups.map((g) => (
                            <SelectItem key={g.id} value={g.id}>
                              {g.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        Custom weights
                      </Label>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Button
                          variant={p.weights ? "default" : "outline"}
                          size="sm"
                          onClick={() =>
                            updatePass(p.id, {
                              weights: p.weights
                                ? null
                                : { ...DEFAULT_WEIGHTS },
                            })
                          }
                        >
                          {p.weights ? "Using custom" : "Inherit global"}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {p.weights && (
                    <div className="grid grid-cols-5 gap-2 rounded-md border border-warning/30 bg-warning/5 p-3">
                      {WEIGHT_FIELDS.map((f) => (
                        <div key={f.key}>
                          <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            {f.label}
                          </Label>
                          <Input
                            type="number"
                            value={p.weights![f.key]}
                            onChange={(e) =>
                              updatePass(p.id, {
                                weights: {
                                  ...p.weights!,
                                  [f.key]: Number(e.target.value),
                                },
                              })
                            }
                            className="mt-1 bg-surface font-mono text-xs"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <ExclusionPicker
                    label="Manually exclude students"
                    items={state.students
                      .filter(
                        (s) =>
                          state.groups
                            .find((g) => g.id === p.student_group_id)
                            ?.students.includes(s.name) ?? true,
                      )
                      .map((s) => ({
                        id: s.name,
                        label: s.name,
                      }))}
                    selected={p.ignored_students}
                    onChange={(ids) =>
                      updatePass(p.id, { ignored_students: ids })
                    }
                  />

                  <ExclusionPicker
                    label="Manually exclude slots"
                    items={state.fetchedSlots
                      .filter((s) => s.subject.includes(p.slot_subject_filter))
                      .map((s) => ({
                        id: s.id,
                        label: `${s.id} · ${s.teacher} · ${s.date} ${s.start_hour}`,
                      }))}
                    selected={p.ignored_slot_ids}
                    onChange={(ids) =>
                      updatePass(p.id, { ignored_slot_ids: ids })
                    }
                    mono
                  />
                </div>
              )}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}

function ExclusionPicker({
  label,
  items,
  selected,
  onChange,
  mono,
}: {
  label: string;
  items: { id: string; label: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  mono?: boolean;
}) {
  const set = new Set(selected);
  return (
    <div>
      <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label} <span className="text-primary">({selected?.length})</span>
      </Label>
      <div className="mt-1.5 flex max-h-40 flex-wrap gap-1 overflow-y-auto rounded-md border border-border bg-surface p-2 scrollbar-thin">
        {items.length === 0 && (
          <span className="px-1 py-0.5 text-xs text-muted-foreground">—</span>
        )}
        {items.map((it) => {
          const on = set.has(it.id);
          return (
            <button
              key={it.id}
              onClick={() => {
                const ns = new Set(selected);
                on ? ns.delete(it.id) : ns.add(it.id);
                onChange(Array.from(ns));
              }}
              className={cn(
                "rounded px-2 py-0.5 text-[11px] transition-colors",
                mono && "font-mono",
                on
                  ? "bg-destructive/15 text-destructive line-through"
                  : "bg-surface-2 text-muted-foreground hover:text-foreground",
              )}
            >
              {it.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
