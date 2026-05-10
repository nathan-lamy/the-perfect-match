import { useState } from "react";
import { useStore } from "@/lib/store";
import { Panel, StageHeader, StatPill } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";
import { ComputeResult } from "@/lib/types";

export function ComputeStage() {
  const { state, setState, log, result, setResult, setStage, globalWeights } =
    useStore();
  const [running, setRunning] = useState(false);

  const run = async () => {
    if (state.selectedSlotIds.length === 0) {
      toast.error("Select slots first");
      return;
    }
    if (state.students.length === 0) {
      toast.error("Load students first");
      return;
    }
    setRunning(true);
    setResult(null);
    log(
      "info",
      `Computing — ${state.iterations} parallel runs across ${state.passes.length} passes`,
    );

    try {
      const startAt = performance.now();
      const passes = (await invoke("compute_assignment", {
        students: state.students,
        slots: state.fetchedSlots.filter((s) =>
          state.selectedSlotIds.includes(s.id),
        ),
        restrictions: state.restrictions,
        // TODO:
        pastColles: [],
        collesCount: state.historicalCounts,
        globalRules: state.globalRules,
        globalWeights: globalWeights,
        passes: state.passes,
        groups: state.groups,
        n: state.iterations,
      })) as ComputeResult["passes"];
      console.log(passes);

      const computation_ms = Math.round(performance.now() - startAt);
      setResult({
        passes,
        computation_ms,
        iterations: state.iterations,
      });
      log(
        "success",
        `Computed in ${computation_ms}ms · ${passes.length} passes`,
      );
      toast.success(`Best of ${state.iterations} runs found`);
    } catch (e) {
      console.error(e);
      log("error", `Compute failed: ${(e as Error).message}`);
      toast.error("Compute failed");
    } finally {
      setRunning(false);
    }
  };

  const totalAssigned =
    result?.passes.reduce((a, p) => a + p.assignments.length, 0) ?? 0;
  const totalUnassigned =
    result?.passes.reduce((a, p) => a + p.unassigned_students.length, 0) ?? 0;

  return (
    <div>
      <StageHeader
        eyebrow="09 · Solve"
        title="Compute assignment"
        description="Runs the Hungarian algorithm N times in parallel. The lowest-scoring solution wins."
        actions={
          <div className="flex items-center gap-3">
            <div>
              <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Iterations
              </Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={state.iterations}
                onChange={(e) =>
                  setState({ iterations: Math.max(1, Number(e.target.value)) })
                }
                className="mt-1 w-24 bg-surface font-mono"
              />
            </div>
            <Button
              size="lg"
              onClick={run}
              disabled={running}
              className="shadow-glow"
            >
              {running ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Computing…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" /> Run
                </>
              )}
            </Button>
          </div>
        }
      />

      {!result && !running && (
        <Panel className="p-12 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-mint shadow-glow">
            <Sparkles className="h-7 w-7 text-primary-foreground" />
          </div>
          <h2 className="mt-5 text-lg font-medium">Ready to solve</h2>
          <div className="mt-2 font-mono text-xs text-muted-foreground">
            {state.students.length} students · {state.selectedSlotIds.length}{" "}
            slots · {state.passes.length} passes
          </div>
          <Button className="mt-6" onClick={run}>
            <Sparkles className="mr-2 h-4 w-4" /> Run computation
          </Button>
        </Panel>
      )}

      {running && (
        <Panel className="p-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <div className="mt-4 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Spinning up {state.iterations} parallel solvers…
          </div>
        </Panel>
      )}

      {result && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatPill label="Assigned" value={totalAssigned} accent="primary" />
            <StatPill
              label="Unassigned"
              value={totalUnassigned}
              accent={totalUnassigned ? "warning" : undefined}
            />
            {/* <StatPill
              label="Violations"
              value={result.quota_violations.length}
              accent={result.quota_violations.length ? "danger" : undefined}
            /> */}
            <StatPill label="Compute" value={`${result.computation_ms}ms`} />
            <StatPill label="Iterations" value={result.iterations} />
          </div>

          <div className="mb-6 space-y-4">
            {result.passes.map((p) => (
              <Panel key={p.pass_id}>
                <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 font-mono text-xs text-primary">
                      P{result.passes.indexOf(p) + 1}
                    </div>
                    <span className="font-medium">{p.pass_name}</span>
                    {p.unassigned_students.length === 0 ? (
                      <span className="flex items-center gap-1 rounded bg-success/10 px-1.5 py-0.5 font-mono text-[10px] uppercase text-success">
                        <CheckCircle2 className="h-3 w-3" /> all placed
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded bg-warning/10 px-1.5 py-0.5 font-mono text-[10px] uppercase text-warning">
                        <AlertTriangle className="h-3 w-3" />{" "}
                        {p.unassigned_students.length} unplaced
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">
                    score{" "}
                    <span className="text-foreground">
                      {p.total_score.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="divide-y divide-border/40">
                  {p.assignments
                    .sort((a, b) => a.student.localeCompare(b.student))
                    .map((a) => {
                      const stu = state.students.find(
                        (s) => s.name === a.student,
                      );
                      const slot = state.fetchedSlots.find(
                        (s) => s.id === a.slot_id,
                      );
                      return (
                        <div
                          key={a.student + a.slot_id}
                          className="grid grid-cols-[1fr_auto_2fr] items-center gap-4 px-5 py-2 hover:bg-surface/40"
                        >
                          <div className="font-medium">
                            {stu?.name ?? a.student}
                          </div>
                          <div className="font-mono text-xs text-muted-foreground">
                            →
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {slot?.date} {slot?.start_hour}
                            </span>
                            <span className="text-sm">{slot?.teacher}</span>
                            <span className="font-mono text-[10px] uppercase text-muted-foreground">
                              {slot?.subject}
                            </span>
                            <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                              {a.slot_id}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  {p.unassigned_students.map((sid) => {
                    const stu = state.students.find((s) => s.name === sid);
                    return (
                      <div
                        key={sid}
                        className="flex items-center gap-3 bg-warning/5 px-5 py-2"
                      >
                        <XCircle className="h-3.5 w-3.5 text-warning" />
                        <div className="font-medium">{stu?.name ?? sid}</div>
                        <span className="font-mono text-[11px] text-warning">
                          no compatible slot found
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            ))}
          </div>

          {/* <QuotaGrid /> */}

          <div className="mt-6 flex justify-end">
            <Button size="lg" onClick={() => setStage("publish")}>
              Continue to Publish →
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// function QuotaGrid() {
//   const { state, result } = useStore();
//   if (!result) return null;
//   const quotas = state.quotas;
//   const students = state.students;

//   if (quotas.length === 0) {
//     return (
//       <Panel
//         title="Quota tracking"
//         className="p-6 text-center text-sm text-muted-foreground"
//       >
//         No quotas defined. Add some in step 8 to track progress.
//       </Panel>
//     );
//   }

//   const lookup = new Map<string, (typeof result.quota_progress)[number]>();
//   for (const p of result.quota_progress)
//     lookup.set(`${p.student_id}|${p.quota_id}`, p);

//   return (
//     <Panel title="Quota progress" className="overflow-hidden">
//       <div className="overflow-x-auto scrollbar-thin">
//         <table className="w-full text-xs">
//           <thead>
//             <tr className="border-b border-border/60">
//               <th className="sticky left-0 bg-card px-4 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
//                 Student
//               </th>
//               {quotas.map((q) => (
//                 <th
//                   key={q.id}
//                   className="px-3 py-2 text-left font-mono text-[10px] font-normal uppercase tracking-wider text-muted-foreground"
//                 >
//                   <div>{q.name}</div>
//                   <div className="font-normal text-muted-foreground/60">
//                     max {q.max_colles}
//                   </div>
//                 </th>
//               ))}
//             </tr>
//           </thead>
//           <tbody>
//             {students.map((s) => (
//               <tr
//                 key={s.id}
//                 className="border-b border-border/40 hover:bg-surface/40"
//               >
//                 <td className="sticky left-0 bg-card px-4 py-1.5 font-medium">
//                   {s.name}
//                 </td>
//                 {quotas.map((q) => {
//                   const p = lookup.get(`${s.id}|${q.id}`);
//                   if (!p)
//                     return (
//                       <td
//                         key={q.id}
//                         className="px-3 py-1.5 text-muted-foreground/40"
//                       >
//                         —
//                       </td>
//                     );
//                   const pct = Math.min(
//                     100,
//                     (p.assigned_count / p.max_colles) * 100,
//                   );
//                   const over = p.assigned_count > p.max_colles;
//                   return (
//                     <td key={q.id} className="px-3 py-1.5">
//                       <div className="flex items-center gap-2">
//                         <div className="relative h-1.5 w-24 overflow-hidden rounded-full bg-surface-2">
//                           <div
//                             className={cn(
//                               "absolute inset-y-0 left-0 rounded-full",
//                               over
//                                 ? "bg-destructive"
//                                 : pct > 80
//                                   ? "bg-warning"
//                                   : "bg-primary",
//                             )}
//                             style={{ width: `${Math.min(100, pct)}%` }}
//                           />
//                         </div>
//                         <span
//                           className={cn(
//                             "font-mono text-[11px]",
//                             over
//                               ? "font-semibold text-destructive"
//                               : "text-muted-foreground",
//                           )}
//                         >
//                           {p.assigned_count}/{p.max_colles}
//                         </span>
//                       </div>
//                     </td>
//                   );
//                 })}
//               </tr>
//             ))}
//           </tbody>
//         </table>
//       </div>
//     </Panel>
//   );
// }
