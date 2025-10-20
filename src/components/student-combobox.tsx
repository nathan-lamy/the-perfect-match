"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import type { Student } from "@/types";

interface StudentComboboxProps {
  students: Student[];
  selectedStudentIds: string[];
  onStudentToggle: (studentId: string) => void;
}

export function StudentCombobox({
  students,
  selectedStudentIds,
  onStudentToggle,
}: StudentComboboxProps) {
  const [open, setOpen] = useState(false);

  const selectedStudents = students.filter((s) =>
    selectedStudentIds.includes(s.id)
  );
  const availableStudents = students.filter(
    (s) => !selectedStudentIds.includes(s.id)
  );

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between bg-transparent"
          >
            {selectedStudentIds.length === 0
              ? "Sélectionner des élèves..."
              : `${selectedStudentIds.length} élève(s) sélectionné(s)`}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Rechercher un élève..." />
            <CommandList>
              <CommandEmpty>Aucun élève trouvé.</CommandEmpty>
              <CommandGroup>
                {availableStudents.map((student) => (
                  <CommandItem
                    key={student.id}
                    value={student.name}
                    onSelect={() => {
                      onStudentToggle(student.id);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedStudentIds.includes(student.id)
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    {student.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedStudents.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedStudents.map((student) => (
            <Badge key={student.id} variant="secondary" className="gap-1">
              {student.name}
              <button
                onClick={() => onStudentToggle(student.id)}
                className="ml-1 rounded-full hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
