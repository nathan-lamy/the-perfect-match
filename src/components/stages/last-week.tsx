import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useStore } from "@/lib/store";
import { Panel, StageHeader, Empty, StatPill } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CalendarIcon,
  History,
  Loader2,
  RefreshCw,
  SkipForward,
  X,
} from "lucide-react";
import { cn, parseISODate, previousMondayISO, toISO } from "@/lib/utils";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";
import { LastWeekColle } from "@/lib/types";

export function LastWeekStage() {
  const { state, setState, log, setStage } = useStore();
  const [loading, setLoading] = useState(false);
  const [pickedDate, setPickedDate] = useState<string>(
    state.lastWeekDate ?? previousMondayISO(),
  );

  const fetchLastWeek = async () => {
    if (state.students.length === 0) {
      toast.error("Load students first");
      return;
    }

    setLoading(true);
    log("info", `Fetching last week colles via Rust for ${pickedDate}`);

    try {
      const colles = await invoke("fetch_last_week_colles", {
        className: "MP-2",
        date: pickedDate,
      }) as LastWeekColle[];

      setState({
        lastWeekDate: pickedDate,
        lastWeekColles: colles,
      });

      log("success", `${colles.length} colles loaded from API`);
      toast.success(`${colles.length} colles loaded`);
    } catch (e) {
      // 'e' will contain the String error returned from Rust's Err()
      log("error", `Rust Bridge Error: ${e}`);
      toast.error("Failed to load colles from server");
    } finally {
      setLoading(false);
    }
  };

  const skip = () => {
    setState({ lastWeekDate: null, lastWeekColles: [] });
    log("info", "Skipped last week colles");
    setStage("rules");
  };

  const grouped = useMemo(() => {
    const m = new Map<string, typeof state.lastWeekColles>();
    for (const c of state.lastWeekColles) {
      if (!m.has(c.subject)) m.set(c.subject, []);
      m.get(c.subject)!.push(c);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [state.lastWeekColles]);

  const subjects = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of state.lastWeekColles)
      m.set(c.subject, (m.get(c.subject) ?? 0) + 1);
    return Array.from(m.entries());
  }, [state.lastWeekColles]);

  const uniqueStudents = useMemo(
    () => new Set(state.lastWeekColles.map((c) => c.student)).size,
    [state.lastWeekColles],
  );

  return (
    <div>
      <StageHeader
        eyebrow="06 · History"
        title="Last week's colles"
        description="Load last week's assignments so the optimizer avoids repeats. Skip if you don't have any."
        actions={
          <Button variant="ghost" onClick={skip}>
            <SkipForward className="mr-2 h-3.5 w-3.5" /> Skip this step
          </Button>
        }
      />

      <Panel className="mb-6 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Last week starting (Monday)
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "mt-1 w-56 justify-start bg-surface text-left font-normal",
                    !pickedDate && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {pickedDate ? (
                    format(parseISODate(pickedDate)!, "EEE, MMM d, yyyy")
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={parseISODate(pickedDate)}
                  onSelect={(d) => d && setPickedDate(toISO(d))}
                  weekStartsOn={1}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          <Button onClick={fetchLastWeek} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-3.5 w-3.5" /> Load last week
              </>
            )}
          </Button>
          {state.lastWeekColles.length > 0 && (
            <Button
              variant="ghost"
              onClick={() => {
                setState({ lastWeekDate: null, lastWeekColles: [] });
                toast.success("Cleared");
              }}
            >
              <X className="mr-2 h-3.5 w-3.5" /> Clear
            </Button>
          )}
        </div>
      </Panel>

      {state.lastWeekColles.length === 0 ? (
        <Empty
          icon={<History className="h-5 w-5" />}
          title="No last week colles loaded"
          hint="Pick a Monday and load, or skip this step."
        />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <StatPill
              label="Colles"
              value={state.lastWeekColles.length}
              accent="primary"
            />
            <StatPill label="Students" value={uniqueStudents} />
            <StatPill label="Subjects" value={subjects.length} />
          </div>

          <div className="space-y-3">
            {grouped.map(([subject, colles]) => (
              <Panel key={subject}>
                <div className="flex items-center justify-between border-b border-border/60 px-4 py-2">
                  <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    {subject}
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {colles.length} colles
                  </div>
                </div>
                <div className="divide-y divide-border/40">
                  {colles.map((c) => (
                    <div
                      key={c.id}
                      className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 py-2 hover:bg-surface/40"
                    >
                      <div className="font-medium">{c.student}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        →
                      </div>
                      <div className="text-sm">{c.teacher}</div>
                    </div>
                  ))}
                </div>
              </Panel>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <Button size="lg" onClick={() => setStage("rules")}>
              Continue to Rules →
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
