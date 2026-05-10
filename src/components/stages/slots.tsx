import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Panel, StageHeader, Empty, StatPill } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CalendarIcon,
  CalendarRange,
  Loader2,
  RefreshCw,
  Search,
  AlertTriangle,
} from "lucide-react";
import { cn, parseISODate, toISO } from "@/lib/utils";
import { invoke } from "@tauri-apps/api/core";
import { format } from "date-fns";

export function SlotsStage() {
  const { state, setState, log } = useStore();
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchSlots = async () => {
    setLoading(true);
    log(
      "info",
      `Fetching slots ${state.dateRange.start} → ${state.dateRange.end}`,
    );

    try {
      // TODO: Use URL to publish fetched slots for debugging and reproducibility
      const { colles: slots, url } = (await invoke("fetch_future_colles", {
        cookie: state.session!,
        startDate: state.dateRange.start,
        endDate: state.dateRange.end,
      })) as { colles: typeof state.fetchedSlots; url: string };
      setState({
        fetchedSlots: slots,
        selectedSlotIds: slots.filter((s) => !s.is_assigned).map((s) => s.id),
        originUrl: url,
      });
      log("success", `${slots.length} slots fetched`);
      setError(null);
    } catch (e) {
      console.error(e);
      const msg =
        e instanceof Error ? e.message : "Unknown error while fetching slots.";
      setError(msg);
      log("error", `Failed to fetch slots: ${msg}`);
    }

    setLoading(false);
  };

  const grouped = useMemo(() => {
    const m = new Map<string, typeof state.fetchedSlots>();
    for (const s of state.fetchedSlots) {
      if (
        filter &&
        !`${s.teacher} ${s.subject}`
          .toLowerCase()
          .includes(filter.toLowerCase())
      )
        continue;
      if (!m.has(s.date)) m.set(s.date, []);
      m.get(s.date)!.push(s);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [state.fetchedSlots, filter]);

  const selected = new Set(state.selectedSlotIds);
  const toggle = (id: string) => {
    setState((s) => {
      const set = new Set(s.selectedSlotIds);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { selectedSlotIds: Array.from(set) };
    });
  };
  const setAll = (ids: string[], on: boolean) =>
    setState((s) => {
      const set = new Set(s.selectedSlotIds);
      for (const id of ids) on ? set.add(id) : set.delete(id);
      return { selectedSlotIds: Array.from(set) };
    });

  const subjects = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of state.fetchedSlots)
      m.set(s.subject, (m.get(s.subject) ?? 0) + 1);
    return Array.from(m.entries());
  }, [state.fetchedSlots]);

  return (
    <div>
      <StageHeader
        eyebrow="05 · Inventory"
        title="Available slots"
        description="Pull the available colle slots from BJColle for a date range, then pick which ones to include."
      />

      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            <div className="font-medium">Failed to fetch slots</div>
            <div className="mt-0.5 text-xs opacity-90">{error}</div>
          </div>
          <button
            onClick={fetchSlots}
            className="font-mono text-[10px] uppercase tracking-wider underline-offset-2 hover:underline"
          >
            retry
          </button>
        </div>
      )}

      <Panel className="mb-6 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              From
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "mt-1 w-36 justify-start bg-surface text-left font-normal ml-2",
                    !state.dateRange.start && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {state.dateRange.start ? (
                    format(parseISODate(state.dateRange.start)!, "EEE, MMM d")
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={parseISODate(state.dateRange.start)}
                  onSelect={(d) => {
                    if (!d) return;
                    const start = toISO(d);
                    if (d.getDay() === 1) {
                      const end = new Date(d);
                      end.setDate(d.getDate() + 6);
                      setState({ dateRange: { start, end: toISO(end) } });
                    } else {
                      setState((s) => ({
                        dateRange: { ...s.dateRange, start },
                      }));
                    }
                  }}
                  weekStartsOn={1}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              To
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "mt-1 w-36 justify-start bg-surface text-left font-normal ml-2",
                    !state.dateRange.end && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {state.dateRange.end ? (
                    format(parseISODate(state.dateRange.end)!, "EEE, MMM d")
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={parseISODate(state.dateRange.end)}
                  onSelect={(d) =>
                    d &&
                    setState((s) => ({
                      dateRange: { ...s.dateRange, end: toISO(d) },
                    }))
                  }
                  weekStartsOn={1}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          <Button onClick={fetchSlots} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Fetching…
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-3.5 w-3.5" /> Fetch slots
              </>
            )}
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter teacher or subject…"
                className="w-64 bg-surface pl-8"
              />
            </div>
          </div>
        </div>
      </Panel>

      {state.fetchedSlots.length === 0 ? (
        <Empty
          icon={<CalendarRange className="h-5 w-5" />}
          title="No slots fetched"
          hint="Pick a date range and fetch."
        />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-4 gap-3">
            <StatPill label="Slots fetched" value={state.fetchedSlots.length} />
            <StatPill label="Selected" value={selected.size} accent="primary" />
            <StatPill label="Subjects" value={subjects.length} />
            <StatPill label="Days" value={grouped.length} />
          </div>

          <div className="mb-3 flex items-center gap-2 text-xs">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setAll(
                  state.fetchedSlots.map((s) => s.id),
                  true,
                )
              }
            >
              Select all
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setAll(
                  state.fetchedSlots.map((s) => s.id),
                  false,
                )
              }
            >
              Clear
            </Button>
            {subjects.map(([sub, n]) => (
              <Button
                key={sub}
                size="sm"
                variant="ghost"
                onClick={() =>
                  setAll(
                    state.fetchedSlots
                      .filter((s) => s.subject === sub)
                      .map((s) => s.id),
                    true,
                  )
                }
              >
                +{sub}{" "}
                <span className="ml-1 font-mono text-muted-foreground">
                  {n}
                </span>
              </Button>
            ))}
          </div>

          <div className="space-y-3">
            {grouped.map(([date, slots]) => (
              <Panel key={date}>
                <div className="flex items-center justify-between border-b border-border/60 px-4 py-2">
                  <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    {new Date(date).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {slots.filter((s) => selected.has(s.id)).length}/
                    {slots.length}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 p-3 md:grid-cols-3 lg:grid-cols-4">
                  {slots.map((s) => {
                    const on = selected.has(s.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => toggle(s.id)}
                        title={
                          s.is_assigned
                            ? "This slot already has an assignment"
                            : undefined
                        }
                        className={cn(
                          "group relative rounded-lg border p-3 text-left transition-all",
                          on
                            ? "border-primary/60 bg-primary/5 shadow-glow"
                            : "border-border bg-surface hover:border-border-strong",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {s.start_hour}–{s.end_hour}
                          </span>
                          {s.is_assigned ? (
                            <AlertTriangle className="h-3 w-3 text-warning" />
                          ) : (
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                on ? "bg-primary" : "bg-muted-foreground/30",
                              )}
                            />
                          )}
                        </div>
                        <div className="mt-1 truncate text-sm font-medium">
                          {s.teacher}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            {s.subject}
                          </div>
                          {s.is_assigned && (
                            <div className="font-mono text-[9px] uppercase tracking-wider text-warning">
                              Already assigned
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Panel>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
