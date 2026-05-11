import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SESSION_EXPIRY, StoreProvider, useStore } from "@/lib/store";
import { Sidebar } from "@/components/sidebar";
import { ConnectStage } from "@/components/stages/connect";
import { StudentsStage } from "@/components/stages/students";
import { RestrictionsStage } from "@/components/stages/restrictions";
import { GroupsStage } from "@/components/stages/groups";
import { SlotsStage } from "@/components/stages/slots";
import { RulesStage } from "@/components/stages/rules";
import { PassesStage } from "@/components/stages/passes";
// import { QuotasStage } from "@/components/stages/quotas";
import { ComputeStage } from "@/components/stages/compute";
import { PublishStage } from "@/components/stages/publish";
import { DebugDrawer } from "@/components/debug-drawer";
import { CommandPalette } from "@/components/command-palette";
import { Toaster } from "@/components/ui/sonner";
import { Command, Sparkles } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { LastWeekStage } from "@/components/stages/last-week";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <StoreProvider>
      <App />
      <Toaster theme="dark" position="bottom-right" />
    </StoreProvider>
  );
}

function App() {
  const { stage, hydrated, state, setState, log } = useStore();
  const [debugOpen, setDebugOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [bootDone, setBootDone] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inField =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (!inField && (e.key === "`" || e.key === "~")) {
        e.preventDefault();
        setDebugOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const hasValidSession =
      state.session &&
      state.sessionExpiresAt &&
      state.sessionExpiresAt > Date.now();
    const canAuthenticate = state.credentials && !hasValidSession;

    if (!canAuthenticate) {
      if (!bootDone) setBootDone(true);
      return;
    }

    log("info", "Restoring BJColle session…");

    invoke("authenticate", {
      username: state.credentials!.username,
      password: state.credentials!.password,
    })
      .then((session) => {
        setState((prev) => ({
          ...prev,
          session: session as string,
          isConnected: true,
          sessionExpiresAt: Date.now() + SESSION_EXPIRY,
        }));
        log("success", `Reconnected as ${state.credentials!.username}`);
      })
      .catch((err) => {
        console.error("Failed to restore session", err);
        log("error", "Failed to restore session");
        setState((prev) => ({ ...prev, isConnected: false }));
      })
      .finally(() => {
        if (!bootDone) setBootDone(true);
      });
  }, [state.session, state.sessionExpiresAt, state.credentials, bootDone]);

  if (!hydrated || !bootDone) {
    return (
      <BootSplash
        hydrated={hydrated}
        isConnected={state.isConnected}
        username={state.credentials?.username ?? null}
      />
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="sticky top-0 h-screen shrink-0">
        <Sidebar onOpenDebug={() => setDebugOpen(true)} />
      </div>
      <main className="grid-bg relative flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 flex justify-end gap-2 border-b border-border/40 bg-background/70 px-6 py-2.5 backdrop-blur">
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <Command className="h-3 w-3" />
            <span>Quick jump</span>
            <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px]">
              ⌘K
            </kbd>
          </button>
        </div>
        <div className="mx-auto max-w-6xl px-6 py-8 lg:px-10 lg:py-10">
          <StageRoute stage={stage} />
        </div>
      </main>
      <DebugDrawer open={debugOpen} onOpenChange={setDebugOpen} />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onOpenDebug={() => setDebugOpen(true)}
      />
    </div>
  );
}

function BootSplash({
  hydrated,
  isConnected,
  username,
}: {
  hydrated: boolean;
  isConnected: boolean;
  username: string | null;
}) {
  const steps = [
    { label: "Restoring local state", done: hydrated },
    {
      label: "Checking BJColle session",
      done: hydrated,
      note: hydrated
        ? isConnected
          ? `signed in as ${username ?? "user"}`
          : "no active session"
        : null,
    },
    { label: "Preparing workspace", done: hydrated },
  ];
  return (
    <div className="grid-bg flex h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-gradient-mint shadow-glow">
            <Sparkles
              className="h-5 w-5 text-primary-foreground"
              strokeWidth={2.5}
            />
          </div>
          <div className="leading-tight">
            <div className="text-base font-semibold tracking-tight">
              Perfect Match
            </div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              colles · v1
            </div>
          </div>
        </div>
        <div className="space-y-2 rounded-lg border border-border bg-surface/60 p-4 backdrop-blur">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-3 text-xs">
              <span
                className={`h-1.5 w-1.5 rounded-full ${s.done ? "bg-success" : "bg-muted-foreground/40 pulse-dot"}`}
              />
              <span
                className={s.done ? "text-foreground" : "text-muted-foreground"}
              >
                {s.label}
              </span>
              {s.note && (
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                  {s.note}
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {hydrated ? "ready" : "loading…"}
        </div>
      </div>
    </div>
  );
}

function StageRoute({
  stage,
}: {
  stage: ReturnType<typeof useStore>["stage"];
}) {
  switch (stage) {
    case "connect":
      return <ConnectStage />;
    case "students":
      return <StudentsStage />;
    case "restrictions":
      return <RestrictionsStage />;
    case "groups":
      return <GroupsStage />;
    case "slots":
      return <SlotsStage />;
    case "lastWeek":
      return <LastWeekStage />;
    case "rules":
      return <RulesStage />;
    case "passes":
      return <PassesStage />;
    // case "quotas":
    //   return <QuotasStage />;
    case "compute":
      return <ComputeStage />;
    case "publish":
      return <PublishStage />;
  }
}
