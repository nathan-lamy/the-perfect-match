import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type {
  Student,
  Restriction,
  StudentGroup,
  FutureSlot,
  PastColle,
} from "@/types";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface Step3AssignmentProps {
  students: Student[];
  restrictions: Restriction[];
  studentGroups: StudentGroup[];
  futureSlots: FutureSlot[];
  pastColles: PastColle[];
  onNext: () => void;
}

export function Step3Assignment({
  students,
  restrictions,
  studentGroups,
  futureSlots,
  pastColles,
  onNext,
}: Step3AssignmentProps) {
  const [activeRestrictions, setActiveRestrictions] = useState<string[]>(
    restrictions.map((r) => r.id)
  );
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [calculated, setCalculated] = useState(false);
  const [assignmentStats, setAssignmentStats] = useState({
    assigned: 0,
    students: 0,
    score: 0,
  });
  const [error, setError] = useState<string>("");

  const subjects = Array.from(new Set(futureSlots.map((s) => s.subject)));

  const toggleRestriction = (id: string) => {
    setActiveRestrictions((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const handleCalculate = () => {
    setError("");

    if (!selectedSubject) {
      setError("Veuillez sélectionner une matière");
      return;
    }

    const availableSlots = futureSlots.filter(
      (s) => s.subject === selectedSubject && s.available
    );

    let targetStudents = students;
    if (selectedGroup !== "all") {
      const group = studentGroups.find((g) => g.id === selectedGroup);
      if (group) {
        targetStudents = students.filter((s) =>
          group.studentIds.includes(s.id)
        );
      }
    }

    if (targetStudents.length > availableSlots.length) {
      setError(
        `Erreur : ${targetStudents.length} élèves pour seulement ${availableSlots.length} créneaux disponibles`
      );
      return;
    }

    // Simple assignment simulation
    const score = Math.random() * 100;
    setAssignmentStats({
      assigned: Math.min(targetStudents.length, availableSlots.length),
      students: targetStudents.length,
      score: Math.round(score),
    });
    setCalculated(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Étape 3 : Attribuer les colles</CardTitle>
          <CardDescription>
            Configurez les paramètres d'attribution et calculez la répartition
            optimale
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Restrictions */}
          <div className="space-y-3">
            <Label>Restrictions actives</Label>
            {restrictions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune restriction définie
              </p>
            ) : (
              <div className="space-y-2">
                {restrictions.map((restriction) => (
                  <div key={restriction.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`restriction-${restriction.id}`}
                      checked={activeRestrictions.includes(restriction.id)}
                      onCheckedChange={() => toggleRestriction(restriction.id)}
                    />
                    <Label
                      htmlFor={`restriction-${restriction.id}`}
                      className="cursor-pointer"
                    >
                      {restriction.name} ({restriction.startTime} -{" "}
                      {restriction.endTime})
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Subject selection */}
          <div className="space-y-2">
            <Label>Matière</Label>
            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionnez une matière" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((subject) => (
                  <SelectItem key={subject} value={subject}>
                    {subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Group selection */}
          <div className="space-y-2">
            <Label>Groupe d'élèves (optionnel)</Label>
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les élèves</SelectItem>
                {studentGroups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button onClick={handleCalculate}>Calculer l'attribution</Button>
        </CardContent>
      </Card>

      {calculated && !error && (
        <Card>
          <CardHeader>
            <CardTitle>Résultats de l'attribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">
                  Colles attribuées
                </p>
                <p className="text-2xl font-bold">{assignmentStats.assigned}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">
                  Élèves concernés
                </p>
                <p className="text-2xl font-bold">{assignmentStats.students}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">
                  Score de distribution
                </p>
                <p className="text-2xl font-bold">
                  {assignmentStats.score}/100
                </p>
              </div>
            </div>
            <Button onClick={onNext} className="w-full">
              Passer à la publication
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
