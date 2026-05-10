import { useState } from "react";
import { useStore } from "@/lib/store";
import { Panel, StageHeader, Empty, StatPill } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Users, Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { cn, parseStudents, sortStudentsByName } from "@/lib/utils";
import { invoke } from "@tauri-apps/api/core";
import { historicalCounts, Student } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function StudentsStage() {
  const { state, setState, log } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 1 is the discipline ID for Maths in BJColle
  const [subject, setSubject] = useState<string>("1");

  const fetchStudents = async () => {
    setLoading(true);
    log("info", "Fetching students from BJColle…");

    try {
      const historicalCounts = await invoke<historicalCounts[]>(
        "get_students",
        {
          session: state.session!,
          // TODO: Fetch for all disciplines and let the user choose which one to display
          disc: [1, 23, 4, 22],
          // Discipline 1 is for Maths
          // 23 is for English, 4 for French, 22 for Physics
        },
      );
      const students: Student[] = parseStudents(historicalCounts);
      setState({ students, historicalCounts });
      log("success", `${students.length} students loaded`);
      setError(null);
    } catch (e) {
      console.error("Failed to fetch students:", e);
      const msg =
        e instanceof Error
          ? e.message
          : "Unknown error while fetching students.";
      setError(msg);
      log("error", `Failed to fetch students: ${msg}`);
    }

    setLoading(false);
  };

  const subjects = state.historicalCounts.map(({ name, id }) => ({ name, id }));
  const data = state.historicalCounts.find((c) => c.id.toString() === subject)?.counts ?? {};

  const teachers =
    state.students.length > 0
      ? Array.from(
          new Set(
            Object.values(data).flatMap((m) =>
              Object.keys(m),
            ),
          ),
        )
      : [];

  return (
    <div>
      <StageHeader
        eyebrow="02 · Roster"
        title="Students"
        description="The roster fetched from BJColle, with a heatmap of historical colle counts per teacher."
        actions={
          <Button
            onClick={fetchStudents}
            disabled={loading}
            variant={state.students.length ? "outline" : "default"}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Fetching…
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-3.5 w-3.5" />{" "}
                {state.students.length ? "Refresh" : "Fetch students"}
              </>
            )}
          </Button>
        }
      />

      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            <div className="font-medium">Failed to fetch students</div>
            <div className="mt-0.5 text-xs opacity-90">{error}</div>
          </div>
          <button
            onClick={fetchStudents}
            className="font-mono text-[10px] uppercase tracking-wider underline-offset-2 hover:underline"
          >
            retry
          </button>
        </div>
      )}

      {state.students.length === 0 ? (
        <Empty
          icon={<Users className="h-5 w-5" />}
          title="No students loaded"
          hint="Click Fetch students to pull the roster from BJColle."
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-3 gap-3">
            <StatPill
              label="Students"
              value={state.students.length}
              accent="primary"
            />
            <StatPill label="Teachers" value={teachers.length} />
            <StatPill
              label="Avg colles/student"
              value={Math.round(
                Object.values(data).reduce(
                  (a, m) => a + Object.values(m).reduce((x, y) => x + y, 0),
                  0,
                ) / state.students.length,
              )}
            />
          </div>

          <Panel
            title="Colles heatmap"
            className="overflow-hidden"
            action={
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger className="h-7 w-[180px] text-xs">
                  <SelectValue placeholder="All subjects" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          >
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="sticky left-0 bg-card px-4 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Student
                    </th>
                    {teachers.map((t) => (
                      <th
                        key={t}
                        className="px-2 py-2 text-left font-mono text-[10px] font-normal uppercase tracking-wider text-muted-foreground"
                      >
                        <div className="w-20 truncate">{t}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortStudentsByName(state.students).map((s) => (
                    <tr
                      key={s.name}
                      className="border-b border-border/40 hover:bg-surface/40"
                    >
                      <td className="sticky left-0 bg-card px-4 py-1.5 font-medium">
                        {s.name}
                      </td>
                      {teachers.map((t) => {
                        const c = data[s.name]?.[t] ?? 0;
                        const intensity = Math.min(c / 8, 1);
                        return (
                          <td key={t} className="px-2 py-1.5">
                            <div
                              className={cn(
                                "grid h-6 w-9 place-items-center rounded font-mono text-[11px]",
                                c === 0 && "text-muted-foreground/40",
                              )}
                              style={{
                                backgroundColor:
                                  c > 0
                                    ? `oklch(0.86 0.17 165 / ${0.08 + intensity * 0.4})`
                                    : undefined,
                                color:
                                  c >= 5 ? "oklch(0.18 0.02 200)" : undefined,
                              }}
                            >
                              {c}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
