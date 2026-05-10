import { useState } from "react";
import { useStore } from "@/lib/store";
import { Panel, StageHeader, Empty } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FolderTree, Plus, Trash2 } from "lucide-react";
import type { Group } from "@/lib/types";

export function GroupsStage() {
  const { state, setState } = useStore();
  const [name, setName] = useState("");

  const add = () => {
    if (!name.trim()) return;
    const g: Group = { id: `g_${Date.now()}`, name: name.trim(), students: [] };
    setState((s) => ({ groups: [...s.groups, g] }));
    setName("");
  };

  const remove = (id: string) =>
    setState((s) => ({ groups: s.groups.filter((g) => g.id !== id) }));

  const toggle = (gid: string, sid: string) =>
    setState((s) => ({
      groups: s.groups.map((g) =>
        g.id !== gid
          ? g
          : {
              ...g,
              students: g.students.includes(sid)
                ? g.students.filter((x) => x !== sid)
                : [...g.students, sid],
            },
      ),
    }));

  return (
    <div>
      <StageHeader
        eyebrow="04 · Cohorts"
        title="Student groups"
        description="Group students by anything that matters: option choice, level, math track. Used in passes."
      />

      <div className="mb-4 flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Group name (e.g. Math Specialty)"
          className="bg-surface"
        />
        <Button onClick={add}>
          <Plus className="mr-2 h-4 w-4" /> Add group
        </Button>
      </div>

      {state.groups.length === 0 ? (
        <Empty
          icon={<FolderTree className="h-5 w-5" />}
          title="No groups yet"
          hint="A student can belong to multiple groups."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {state.groups.map((g) => (
            <Panel
              key={g.id}
              title={`${g.name} · ${g.students.length}`}
              action={
                <div className="flex items-center gap-2">
                  {state.students.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setState((s) => ({
                          groups: s.groups.map((gr) =>
                            gr.id !== g.id
                              ? gr
                              : {
                                  ...gr,
                                  students:
                                    gr.students.length === s.students.length
                                      ? []
                                      : s.students.map((st) => st.name),
                                },
                          ),
                        }))
                      }
                      className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      {g.students.length === state.students.length
                        ? "Unselect all"
                        : "Select all"}
                    </button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(g.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              }
            >
              <div className="flex flex-wrap gap-1.5 p-4">
                {state.students.length === 0 && (
                  <span className="text-xs text-muted-foreground">
                    Load students first
                  </span>
                )}
                {state.students.map((s) => {
                  const active = g.students.includes(s.name);
                  return (
                    <button
                      key={s.name}
                      onClick={() => toggle(g.id, s.name)}
                      className={`rounded px-2 py-1 text-xs transition-colors ${active ? "bg-primary text-primary-foreground" : "bg-surface-2 text-muted-foreground hover:text-foreground"}`}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
