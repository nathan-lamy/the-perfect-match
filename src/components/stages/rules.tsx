import { useState } from "react";
import { useStore } from "@/lib/store";
import { Panel, StageHeader, Empty } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Filter, Plus, Trash2, Ban, Settings2 } from "lucide-react";
import type { SlotRule } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function RulesStage() {
  const { state, setState } = useStore();
  const [draft, setDraft] = useState<{
    name: string;
    teacher: string;
    subject: string;
    type: "SetCapacity" | "Ignore";
    value: number;
  }>({
    name: "",
    teacher: "",
    subject: "",
    type: "SetCapacity",
    value: 3,
  });

  const add = () => {
    if (!draft.name.trim()) return;
    const rule: SlotRule = {
      id: `gr_${Date.now()}`,
      name: draft.name.trim(),
      match_teacher: draft.teacher || undefined,
      match_subject: draft.subject || undefined,
      action:
        draft.type === "Ignore"
          ? { type: "Ignore" }
          : { type: "SetCapacity", value: draft.value },
    };
    setState((s) => ({ globalRules: [...s.globalRules, rule] }));
    setDraft({
      name: "",
      teacher: "",
      subject: "",
      type: "SetCapacity",
      value: 3,
    });
  };

  const remove = (id: string) =>
    setState((s) => ({
      globalRules: s.globalRules.filter((r) => r.id !== id),
    }));

  return (
    <div>
      <StageHeader
        eyebrow="06 · Rules"
        title="Global slot rules"
        description="Override slot capacity or ignore slots that match a teacher / subject pattern. Per-pass rules layer on top."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Panel title="New rule" className="p-5">
          <div className="space-y-4">
            <div>
              <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Name
              </Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="mt-1.5 bg-surface"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Teacher (exact)
                </Label>
                <Input
                  value={draft.teacher}
                  onChange={(e) =>
                    setDraft({ ...draft, teacher: e.target.value })
                  }
                  placeholder="Optional"
                  className="mt-1.5 bg-surface"
                />
              </div>
              <div>
                <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Subject contains
                </Label>
                <Input
                  value={draft.subject}
                  onChange={(e) =>
                    setDraft({ ...draft, subject: e.target.value })
                  }
                  placeholder="Optional"
                  className="mt-1.5 bg-surface"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Action
                </Label>
                <Select
                  value={draft.type}
                  onValueChange={(v: "SetCapacity" | "Ignore") =>
                    setDraft({ ...draft, type: v })
                  }
                >
                  <SelectTrigger className="mt-1.5 bg-surface">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SetCapacity">Set capacity</SelectItem>
                    <SelectItem value="Ignore">Ignore slot</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {draft.type === "SetCapacity" && (
                <div>
                  <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    Capacity
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    value={draft.value}
                    onChange={(e) =>
                      setDraft({ ...draft, value: Number(e.target.value) })
                    }
                    className="mt-1.5 bg-surface"
                  />
                </div>
              )}
            </div>
            <Button onClick={add} className="w-full">
              <Plus className="mr-2 h-4 w-4" /> Add rule
            </Button>
          </div>
        </Panel>

        <Panel title={`Active rules · ${state.globalRules.length}`}>
          {state.globalRules.length === 0 ? (
            <div className="p-5">
              <Empty
                icon={<Filter className="h-5 w-5" />}
                title="No global rules"
              />
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {state.globalRules.map((r) => (
                <div
                  key={r.id}
                  className="flex items-start gap-3 p-4 hover:bg-surface/40"
                >
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-surface-2 text-muted-foreground">
                    {r.action.type === "Ignore" ? (
                      <Ban className="h-4 w-4" />
                    ) : (
                      <Settings2 className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{r.name}</span>
                      {r.action.type === "SetCapacity" ? (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] uppercase text-primary">
                          cap {r.action.value}
                        </span>
                      ) : (
                        <span className="rounded bg-destructive/10 px-1.5 py-0.5 font-mono text-[10px] uppercase text-destructive">
                          ignore
                        </span>
                      )}
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                      {r.match_teacher && <>teacher = "{r.match_teacher}"</>}
                      {r.match_teacher && r.match_subject && " · "}
                      {r.match_subject && <>subject ⊇ "{r.match_subject}"</>}
                      {!r.match_teacher &&
                        !r.match_subject &&
                        "matches all slots"}
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
