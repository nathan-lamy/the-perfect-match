import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StageHeader({
  eyebrow, title, description, actions,
}: { eyebrow: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-6 border-b border-border/60 pb-6">
      <div>
        <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-primary">{eyebrow}</div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ children, className, title, action }: { children: ReactNode; className?: string; title?: string; action?: ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card shadow-card", className)}>
      {title && (
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function Empty({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/60 bg-surface/40 px-6 py-14 text-center">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-surface-2 text-muted-foreground">{icon}</div>
      <div className="text-sm font-medium text-foreground">{title}</div>
      {hint && <div className="max-w-xs text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function StatPill({ label, value, accent }: { label: string; value: string | number; accent?: "primary" | "warning" | "danger" }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn(
        "mt-1 font-mono text-xl font-semibold",
        accent === "primary" && "text-primary",
        accent === "warning" && "text-warning",
        accent === "danger" && "text-destructive",
      )}>{value}</div>
    </div>
  );
}
