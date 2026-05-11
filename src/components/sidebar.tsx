import { useStore, type Stage } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  Plug,
  Users,
  Clock4,
  FolderTree,
  CalendarRange,
  Filter,
  ListOrdered,
  Sparkles,
  Send,
  Terminal,
  History,
} from "lucide-react";

const STAGES: { id: Stage; label: string; icon: typeof Plug; hint: string }[] =
  [
    { id: "connect", label: "Connect", icon: Plug, hint: "BJColle session" },
    {
      id: "students",
      label: "Students",
      icon: Users,
      hint: "Roster + history",
    },
    {
      id: "restrictions",
      label: "Restrictions",
      icon: Clock4,
      hint: "Activity conflicts",
    },
    {
      id: "slots",
      label: "Slots",
      icon: CalendarRange,
      hint: "Fetch & select",
    },
    { id: "lastWeek", label: "Last week", icon: History, hint: "Past colles" },
    { id: "groups", label: "Groups", icon: FolderTree, hint: "Cohorts" },
    { id: "rules", label: "Rules", icon: Filter, hint: "Capacity & ignore" },
    { id: "passes", label: "Passes", icon: ListOrdered, hint: "Pipeline" },
    // { id: "quotas", label: "Quotas", icon: Gauge, hint: "Subject limits" },
    { id: "compute", label: "Compute", icon: Sparkles, hint: "Run algorithm" },
    { id: "publish", label: "Publish", icon: Send, hint: "Push to BJColle" },
  ];

export function Sidebar({ onOpenDebug }: { onOpenDebug: () => void }) {
  const { stage, setStage, state, result } = useStore();
  const status = state.isConnected ? "connected" : "offline";

  const completed = (s: Stage): boolean => {
    switch (s) {
      case "connect":
        return state.isConnected;
      case "students":
        return state.students.length > 0;
      case "slots":
        return state.selectedSlotIds.length > 0;
      case "compute":
        return result !== null;
      case "publish":
        return false;
      default:
        return false;
    }
  };

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-mint shadow-glow">
          <Sparkles
            className="h-4 w-4 text-primary-foreground"
            strokeWidth={2.5}
          />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight">
            The Perfect Match
          </div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            By Nathan · v2
          </div>
        </div>
      </div>

      <div className="mx-3 mb-3 flex items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/30 px-3 py-2">
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            status === "connected"
              ? "bg-success pulse-dot"
              : "bg-muted-foreground/50",
          )}
        />
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          bjcolle.fr · {status}
        </span>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 scrollbar-thin">
        {STAGES.map((s, i) => {
          const Icon = s.icon;
          const active = stage === s.id;
          const done = completed(s.id);
          return (
            <button
              key={s.id}
              onClick={() => setStage(s.id)}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-foreground",
              )}
            >
              <div className="flex w-5 items-center justify-center">
                <span
                  className={cn(
                    "font-mono text-[10px]",
                    active ? "text-primary" : "text-muted-foreground/60",
                  )}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{s.label}</div>
              </div>
              {done && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
              {active && (
                <span className="absolute inset-y-1 left-0 w-0.5 rounded-r bg-primary" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={onOpenDebug}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-foreground"
        >
          <Terminal className="h-3.5 w-3.5" />
          <span className="font-mono uppercase tracking-wider">Debug</span>
          <kbd className="ml-auto rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px]">
            ~
          </kbd>
        </button>
      </div>
    </aside>
  );
}
