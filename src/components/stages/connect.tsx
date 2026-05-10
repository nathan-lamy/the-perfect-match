import { useState } from "react";
import { useStore } from "@/lib/store";
import { Panel, StageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plug, Loader2, CheckCircle2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";

export function ConnectStage() {
  const { state, setState, log, setStage } = useStore();
  const [username, setUsername] = useState(state.credentials?.username ?? "");
  const [password, setPassword] = useState(state.credentials?.password ?? "");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  const connect = async () => {
    if (!username || !password) { toast.error("Username and password required"); return; }
    setLoading(true);
    log("info", `Connecting to bjcolle.fr as ${username}…`);

    try {
      const session = await invoke("authenticate", { username, password }) as string;
      setState({
        credentials: remember ? { username, password } : null,
        session,
        isConnected: true,
      });

      log("success", "Connected to BJColle");
      toast.success("Connected to BJColle");
      setStage("students");
    } catch (e) {
      log("error", `Connection failed: ${(e as Error).message}`);
      toast.error("Connection failed");
    } finally {
      setLoading(false);
    }
  };

  const disconnect = () => {
    setState({ isConnected: false });
    log("info", "Disconnected");
  };

  return (
    <div className="mx-auto max-w-2xl">
      <StageHeader
        eyebrow="01 · Session"
        title="Connect to BJColle"
        description="Sign in once. Your credentials stay in this browser, the session is reopened automatically every week."
      />

      {state.isConnected ? (
        <Panel className="p-6">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-lg bg-success/10 text-success">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">Active session</div>
              <div className="font-mono text-xs text-muted-foreground">{state.credentials?.username ?? "anonymous"} · bjcolle.fr</div>
            </div>
            <Button variant="ghost" size="sm" onClick={disconnect}>
              <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
            </Button>
            <Button onClick={() => setStage("students")}>Continue</Button>
          </div>
        </Panel>
      ) : (
        <Panel className="p-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="u" className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Username</Label>
              <Input id="u" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="prof.dupont" autoComplete="username" className="mt-1.5 bg-surface" />
            </div>
            <div>
              <Label htmlFor="p" className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Password</Label>
              <Input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="mt-1.5 bg-surface" />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-primary" />
              Remember credentials
            </label>
            <Button onClick={connect} disabled={loading} className="w-full">
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Authenticating…</> : <><Plug className="mr-2 h-4 w-4" /> Connect</>}
            </Button>
          </div>
        </Panel>
      )}
    </div>
  );
}
