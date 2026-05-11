import { useState } from "react";
import { useStore } from "@/lib/store";
import { Panel, StageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import {
  Send,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatDate } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { listen } from "@tauri-apps/api/event";
import { ColleProgressEvent } from "@/lib/types";
import { invoke } from "@tauri-apps/api/core";

export function PublishStage() {
  const { result, state, publishProgress, setPublishProgress, log } =
    useStore();
  const [errors, setErrors] = useState<{ slotId: string; msg: string }[]>([]);

  const allAssignments = result?.passes.flatMap((p) => p.assignments) ?? [];

  const publish = async () => {
    if (allAssignments.length === 0) return;
    setErrors([]);
    setPublishProgress({
      total: allAssignments.length,
      done: [],
      current: null,
      running: true,
    });
    log("info", `Publishing ${allAssignments.length} assignments to BJColle…`);

    const unlisten = await listen<ColleProgressEvent>(
      "colle-progress",
      ({ payload }) => {
        if (payload.error) {
          setErrors((e) => [
            ...e,
            { slotId: payload.slot_id, msg: payload.error! },
          ]);
          log(
            "error",
            `Failed to publish ${payload.slot_id}: ${payload.error}`,
          );
        } else {
          log(
            "info",
            `Published ${payload.slot_id} (${payload.done.length}/${payload.total})`,
          );
        }

        setPublishProgress({
          total: payload.total,
          done: payload.done,
          current: payload.done.length < payload.total ? payload.slot_id : null,
          running: payload.done.length < payload.total,
        });

        if (payload.done.length === payload.total) {
          log("success", "Publish complete");
          toast.success("Published to BJColle");
        }
      },
    );

    try {
      await invoke("publish_colles", {
        assignments: allAssignments,
        cookie: state.session!,
        date: formatDate(state.dateRange.start),
      });
    } finally {
      unlisten();
    }
  };

  const nuke = async () => {
    log(
      "warn",
      `Deleting all assignments on BJColle… for date ${state.dateRange.start} (this cannot be undone)`,
    );

    let toastId: string | number | undefined;

    const unlisten = await listen<ColleProgressEvent>(
      "nuke-progress",
      ({ payload }) => {
        const msg = `Deleting assignments… ${payload.done.length}/${payload.total}`;
        if (toastId === undefined) {
          toastId = toast.loading(msg);
        } else {
          toast.loading(msg, { id: toastId });
        }
      },
    );

    try {
      await invoke("clear_colles", {
        cookie: state.session!,
        date: formatDate(state.dateRange.start),
      });
      toast.success("All assignments deleted", { id: toastId });
      log("success", "All assignments deleted");
    } catch (e) {
      toast.error("Failed to delete assignments", { id: toastId });
      log("error", `Failed to delete assignments: ${e}`);
    } finally {
      unlisten();
    }
  };

  const pct =
    publishProgress.total > 0
      ? (publishProgress.done.length / publishProgress.total) * 100
      : 0;

  return (
    <div>
      <StageHeader
        eyebrow="10 · Ship"
        title="Publish to BJColle"
        description="Each assignment is pushed individually with a small delay so we don't hammer the platform."
        actions={
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete all on BJColle
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete every assignment?</AlertDialogTitle>
                <AlertDialogDescription>
                  This wipes the week's assignments on bjcolle.fr. There is no
                  undo. Use this only if you need to redo everything.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={nuke}
                  className="bg-destructive text-destructive-foreground"
                >
                  Yes, delete all
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        }
      />

      {!result ? (
        <Panel className="p-10 text-center text-sm text-muted-foreground">
          Run a computation first.
        </Panel>
      ) : (
        <>
          <Panel className="mb-6 p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Ready to publish
                </div>
                <div className="mt-1 text-3xl font-semibold">
                  {allAssignments.length}{" "}
                  <span className="text-base font-normal text-muted-foreground">
                    assignments
                  </span>
                </div>
              </div>
              <Button
                size="lg"
                onClick={publish}
                disabled={publishProgress.running}
                className="shadow-glow"
              >
                {publishProgress.running ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                    Publishing…
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" /> Publish all
                  </>
                )}
              </Button>
            </div>

            {(publishProgress.running || publishProgress.done.length > 0) && (
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between font-mono text-[11px]">
                  <span className="text-muted-foreground">
                    {publishProgress.current
                      ? `→ ${publishProgress.current}`
                      : "complete"}
                  </span>
                  <span className="text-foreground">
                    {publishProgress.done.length}/{publishProgress.total}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-gradient-mint transition-all duration-150"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )}
          </Panel>

          <Panel
            title={`Live feed · ${allAssignments.length} items`}
            className="overflow-hidden"
          >
            <div className="max-h-96 divide-y divide-border/40 overflow-y-auto scrollbar-thin">
              {allAssignments.map((a, i) => {
                const done =
                  publishProgress.done.includes(a.slot_id) ||
                  (!publishProgress.running &&
                    publishProgress.done.length === publishProgress.total &&
                    publishProgress.total > 0);
                const current = publishProgress.current === a.slot_id;
                const error = errors.find((e) => e.slotId === a.slot_id);
                const stu = state.students.find((s) => s.name === a.student);
                const slot = state.fetchedSlots.find((s) => s.id === a.slot_id);
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2 font-mono text-xs transition-colors",
                      current && "bg-primary/5",
                      error && "bg-destructive/5",
                    )}
                  >
                    <span className="w-8 text-right text-muted-foreground">
                      {String(i + 1).padStart(3, "0")}
                    </span>
                    {error ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                    ) : done ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    ) : current ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    ) : (
                      <span className="h-3.5 w-3.5 rounded-full border border-border-strong" />
                    )}
                    <span className="text-foreground">{stu?.name}</span>
                    <span className="text-muted-foreground">→</span>
                    <span>
                      {slot?.teacher} · {slot?.date} {slot?.start_hour}
                    </span>
                    <span className="ml-auto text-muted-foreground/70">
                      {a.slot_id}
                    </span>
                    {error && (
                      <span className="text-destructive">{error.msg}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
