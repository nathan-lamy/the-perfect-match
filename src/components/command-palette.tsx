import { useStore, type Stage } from "@/lib/store";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

const STAGE_ITEMS: { id: Stage; label: string; hint: string }[] = [
  { id: "connect", label: "Connect to BJColle", hint: "01" },
  { id: "students", label: "Students", hint: "02" },
  { id: "restrictions", label: "Restrictions", hint: "03" },
  { id: "groups", label: "Student groups", hint: "04" },
  { id: "slots", label: "Available slots", hint: "05" },
  { id: "rules", label: "Slot rules", hint: "06" },
  { id: "passes", label: "Assignment passes", hint: "07" },
  { id: "quotas", label: "Subject quotas", hint: "08" },
  { id: "compute", label: "Compute assignment", hint: "09" },
  { id: "publish", label: "Publish to BJColle", hint: "10" },
];

export function CommandPalette({ open, onOpenChange, onOpenDebug }: { open: boolean; onOpenChange: (b: boolean) => void; onOpenDebug: () => void }) {
  const { setStage, reset } = useStore();
  const go = (s: Stage) => { setStage(s); onOpenChange(false); };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Jump to stage, run action…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        <CommandGroup heading="Stages">
          {STAGE_ITEMS.map((s) => (
            <CommandItem key={s.id} onSelect={() => go(s.id)} value={s.label}>
              <span className="font-mono text-[10px] text-muted-foreground">{s.hint}</span>
              <span className="ml-3">{s.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Developer">
          <CommandItem onSelect={() => { onOpenDebug(); onOpenChange(false); }}>Open debug drawer</CommandItem>
          <CommandItem onSelect={() => { if (confirm("Reset all data?")) reset(); onOpenChange(false); }}>Reset all data</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
