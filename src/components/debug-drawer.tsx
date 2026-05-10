import { useEffect, useState } from "react";
import { useStore, STORAGE_KEY_EXPORT } from "@/lib/store";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Trash2, Copy, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function DebugDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (b: boolean) => void }) {
  const { state, globalWeights, result, logs, reset } = useStore();
  const [storageDump, setStorageDump] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    try {
      const dump: Record<string, unknown> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)!;
        try { dump[k] = JSON.parse(localStorage.getItem(k) || ""); } catch { dump[k] = localStorage.getItem(k); }
      }
      setStorageDump(JSON.stringify(dump, null, 2));
    } catch { setStorageDump("// localStorage unavailable"); }
  }, [open]);

  const fullState = { state, globalWeights, result };

  const copy = (s: string) => { navigator.clipboard.writeText(s); toast.success("Copied"); };
  const download = (s: string, name: string) => {
    const b = new Blob([s], { type: "application/json" });
    const u = URL.createObjectURL(b);
    const a = document.createElement("a"); a.href = u; a.download = name; a.click();
    URL.revokeObjectURL(u);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-2xl bg-surface p-0 sm:max-w-2xl">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em]">
            <span className="h-1.5 w-1.5 rounded-full bg-primary pulse-dot" /> Debug · Developer
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="result" className="flex h-[calc(100vh-65px)] flex-col">
          <TabsList className="m-4 mb-0 grid grid-cols-4 bg-surface-2">
            <TabsTrigger value="result">Result JSON</TabsTrigger>
            <TabsTrigger value="state">App state</TabsTrigger>
            <TabsTrigger value="storage">localStorage</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="result" className="flex-1 overflow-hidden p-4">
            <JsonView label="ComputeResult" value={result ? JSON.stringify(result, null, 2) : "// no result yet — run computation first"} onCopy={copy} onDownload={(s) => download(s, "result.json")} />
          </TabsContent>

          <TabsContent value="state" className="flex-1 overflow-hidden p-4">
            <JsonView label="State + Weights" value={JSON.stringify(fullState, null, 2)} onCopy={copy} onDownload={(s) => download(s, "state.json")} />
          </TabsContent>

          <TabsContent value="storage" className="flex-1 overflow-hidden p-4">
            <JsonView label={`localStorage[${STORAGE_KEY_EXPORT}]`} value={storageDump} onCopy={copy} onDownload={(s) => download(s, "storage.json")} />
            <Button variant="destructive" size="sm" onClick={reset} className="mt-3">
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Clear all data & reset
            </Button>
          </TabsContent>

          <TabsContent value="logs" className="flex-1 overflow-hidden p-4">
            <div className="h-full overflow-y-auto rounded-lg border border-border bg-background p-3 font-mono text-[11px] scrollbar-thin">
              {logs.length === 0 && <div className="text-muted-foreground">No logs yet.</div>}
              {logs.map((l, i) => (
                <div key={i} className="flex gap-3 py-0.5">
                  <span className="text-muted-foreground/60">{new Date(l.ts).toLocaleTimeString()}</span>
                  <span className={cn(
                    "uppercase",
                    l.level === "info" && "text-accent",
                    l.level === "success" && "text-success",
                    l.level === "warn" && "text-warning",
                    l.level === "error" && "text-destructive",
                  )}>{l.level}</span>
                  <span className="text-foreground">{l.message}</span>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function JsonView({ label, value, onCopy, onDownload }: { label: string; value: string; onCopy: (s: string) => void; onDownload: (s: string) => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => onCopy(value)}><Copy className="mr-1.5 h-3 w-3" /> Copy</Button>
          <Button variant="ghost" size="sm" onClick={() => onDownload(value)}><Download className="mr-1.5 h-3 w-3" /> Download</Button>
        </div>
      </div>
      <pre className="flex-1 overflow-auto rounded-lg border border-border bg-background p-3 font-mono text-[11px] leading-relaxed text-foreground/90 scrollbar-thin">{value}</pre>
    </div>
  );
}
