import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Student } from "@/types";
import { User } from "lucide-react";

interface StudentListProps {
  students: Student[];
}

export function StudentList({ students }: StudentListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Liste des élèves</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {students.map((student) => (
            <div
              key={student.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{student.first_name}</p>
                <p className="text-sm text-muted-foreground">
                  {student.last_name}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
