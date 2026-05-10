import { useState } from "react";
import { useStore } from "@/lib/store";
import { Panel, StageHeader, Empty } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gauge, Plus, Trash2 } from "lucide-react";
import type { SubjectQuota } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function QuotasStage() {
  const { state, setState } = useStore();
  const [draft, setDraft] = useState<{ name: string; subject_filter: string; max_colles: number; group_id: string }>({
    name: "", subject_filter: "", max_colles: 6, group_id: "__all",
  });

  const add = () => {
    if (!draft.name.trim()) return;
    const q: SubjectQuota = {
      id: `q_${Date.now()}`,
      name: draft.name.trim(),
      subject_filter: draft.subject_filter.trim(),
      max_colles: draft.max_colles,
      group_id: draft.group_id === "__all" ? null : draft.group_id,
    };
    setState((s) => ({ quotas: [...s.quotas, q] }));
    setDraft({ name: "", subject_filter: "", max_colles: 6, group_id: "__all" });
  };

  const remove = (id: string) => setState((s) => ({ quotas: s.quotas.filter((q) => q.id !== id) }));

  return (
    <div>
      <StageHeader eyebrow="08 · Limits" title="Subject quotas" description="Soft caps. Violations are flagged after computation but never block the algorithm." />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Panel title="New quota" className="p-5">
          <div className="space-y-4">
            <div>
              <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Name</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="mt-1.5 bg-surface" placeholder="Max 6 Maths" />
            </div>
            <div>
              <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Subject filter (substring)</Label>
              <Input value={draft.subject_filter} onChange={(e) => setDraft({ ...draft, subject_filter: e.target.value })} className="mt-1.5 bg-surface" placeholder="Mathématiques" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Max colles</Label>
                <Input type="number" value={draft.max_colles} onChange={(e) => setDraft({ ...draft, max_colles: Number(e.target.value) })} className="mt-1.5 bg-surface" />
              </div>
              <div>
                <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Group scope</Label>
                <Select value={draft.group_id} onValueChange={(v) => setDraft({ ...draft, group_id: v })}>
                  <SelectTrigger className="mt-1.5 bg-surface"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">All students</SelectItem>
                    {state.groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={add} className="w-full"><Plus className="mr-2 h-4 w-4" /> Add quota</Button>
          </div>
        </Panel>

        <Panel title={`Active quotas · ${state.quotas.length}`}>
          {state.quotas.length === 0 ? (
            <div className="p-5"><Empty icon={<Gauge className="h-5 w-5" />} title="No quotas configured" /></div>
          ) : (
            <div className="divide-y divide-border/60">
              {state.quotas.map((q) => (
                <div key={q.id} className="flex items-start gap-3 p-4 hover:bg-surface/40">
                  <div className="grid h-8 w-8 place-items-center rounded-md bg-surface-2 text-muted-foreground"><Gauge className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{q.name}</span>
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] uppercase text-primary">max {q.max_colles}</span>
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                      subject ⊇ "{q.subject_filter}"
                      {q.group_id && ` · group ${state.groups.find((g) => g.id === q.group_id)?.name ?? q.group_id}`}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => remove(q.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
