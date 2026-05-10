import { useState } from "react";
import { useStore } from "@/lib/store";
import { Panel, StageHeader, Empty } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock4, Plus, Trash2 } from "lucide-react";
import type { Restriction } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function RestrictionsStage() {
  const { state, setState } = useStore();
  const [draft, setDraft] = useState<Omit<Restriction, "id">>({
    activity_name: "",
    day: "Wednesday",
    start_time: "14:00",
    end_time: "16:00",
    students: [],
  });

  const add = () => {
    if (!draft.activity_name) return;
    const r: Restriction = { ...draft, id: `r_${Date.now()}` };
    setState((s) => ({ restrictions: [...s.restrictions, r] }));
    setDraft({
      activity_name: "",
      day: "Wednesday",
      start_time: "14:00",
      end_time: "16:00",
      students: [],
    });
  };

  const remove = (id: string) =>
    setState((s) => ({
      restrictions: s.restrictions.filter((r) => r.id !== id),
    }));

  const toggleStudent = (id: string) =>
    setDraft((d) => ({
      ...d,
      students: d.students.includes(id)
        ? d.students.filter((x) => x !== id)
        : [...d.students, id],
    }));

  return (
    <div>
      <StageHeader
        eyebrow="03 · Conflicts"
        title="Time restrictions"
        description="Recurring weekly activities that block certain students from certain time windows."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Panel title="New restriction" className="p-5">
          <div className="space-y-4">
            <div>
              <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Activity name
              </Label>
              <Input
                value={draft.activity_name}
                onChange={(e) =>
                  setDraft({ ...draft, activity_name: e.target.value })
                }
                placeholder="Volleyball, Piano…"
                className="mt-1.5 bg-surface"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Day
                </Label>
                <Select
                  value={draft.day}
                  onValueChange={(v) => setDraft({ ...draft, day: v })}
                >
                  <SelectTrigger className="mt-1.5 bg-surface">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Start
                </Label>
                <Input
                  type="time"
                  value={draft.start_time}
                  onChange={(e) =>
                    setDraft({ ...draft, start_time: e.target.value })
                  }
                  className="mt-1.5 bg-surface"
                />
              </div>
              <div>
                <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  End
                </Label>
                <Input
                  type="time"
                  value={draft.end_time}
                  onChange={(e) =>
                    setDraft({ ...draft, end_time: e.target.value })
                  }
                  className="mt-1.5 bg-surface"
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Affected students ({draft.students.length})
                </Label>
                {state.students.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        students:
                          d.students.length === state.students.length
                            ? []
                            : state.students.map((s) => s.name),
                      }))
                    }
                    className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    {draft.students.length === state.students.length
                      ? "Unselect all"
                      : "Select all"}
                  </button>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5 rounded-md border border-border bg-surface p-2">
                {state.students.length === 0 && (
                  <span className="px-2 py-1 text-xs text-muted-foreground">
                    Load students first
                  </span>
                )}
                {state.students.map((s) => {
                  const active = draft.students.includes(s.name);
                  return (
                    <button
                      key={s.name}
                      onClick={() => toggleStudent(s.name)}
                      className={`rounded px-2 py-1 text-xs transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-surface-2 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <Button onClick={add} className="w-full">
              <Plus className="mr-2 h-4 w-4" /> Add restriction
            </Button>
          </div>
        </Panel>

        <Panel title={`Active restrictions · ${state.restrictions.length}`}>
          {state.restrictions.length === 0 ? (
            <div className="p-5">
              <Empty
                icon={<Clock4 className="h-5 w-5" />}
                title="No restrictions yet"
                hint="Recurring weekly activities will block matching slots in the algorithm."
              />
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {state.restrictions.map((r) => (
                <div
                  key={r.id}
                  className="flex items-start justify-between gap-3 p-4 hover:bg-surface/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{r.activity_name}</span>
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                        {r.day}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {r.start_time}–{r.end_time}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {r.students.map((sid) => {
                        const s = state.students.find((st) => st.name === sid);
                        return (
                          <span
                            key={sid}
                            className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted-foreground"
                          >
                            {s?.name ?? sid}
                          </span>
                        );
                      })}
                      {r.students.length === 0 && (
                        <span className="text-[11px] text-muted-foreground italic">
                          no students
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(r.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
