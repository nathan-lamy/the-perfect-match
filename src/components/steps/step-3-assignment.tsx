import { useEffect, useState } from "react";
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
  StudentsData,
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
import { loadCache, loadSession, saveCache } from "@/lib/utils";
import { invoke } from "@tauri-apps/api/core";
import { Assignment, computeAssignments } from "@/lib/assignment";
import { DownloadTimetableButton } from "@/lib/export";

interface Step3AssignmentProps {
  onNext: () => void;
}

export function Step3Assignment({ onNext }: Step3AssignmentProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [restrictions, setRestrictions] = useState<Restriction[]>([]);
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([]);
  const [futureSlots, setFutureSlots] = useState<FutureSlot[]>([]);
  const [pastColles, setPastColles] = useState<PastColle[]>([]);
  const [startDate, setStartDate] = useState("");

  const [activeRestrictions, setActiveRestrictions] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("");

  // Load initial data from backend and cache
  useEffect(() => {
    const loadedStudents = invoke<Student[]>("load_students").catch(() => []);
    const loadedRestrictions = invoke<Restriction[]>("load_restrictions").catch(
      () => []
    );
    const loadedGroups = invoke<StudentGroup[]>("load_groups").catch(() => []);

    const cachedSlots = loadCache<FutureSlot[]>("future_slots") || [];
    const cachedPastColles = loadCache<PastColle[]>("last_week") || [];
    const cachedDate = loadCache<string>("future_slots_date") || "";

    Promise.all([loadedStudents, loadedRestrictions, loadedGroups]).then(
      ([students, restrictions, groups]) => {
        setStudents(
          students.map((s) => ({
            ...s,
            name: s.last_name + " " + s.first_name,
          }))
        );
        setRestrictions(restrictions);
        setActiveRestrictions(restrictions.map((r) => r.id));
        setStudentGroups(groups);
        setSelectedGroup(groups[0]?.id || "");
      }
    );

    setFutureSlots(cachedSlots);
    setStartDate(cachedDate);
    setPastColles(cachedPastColles);
  }, []);

  const [calculated, setCalculated] = useState(false);
  const [assignment, setAssignment] = useState<any>(null);
  const [error, setError] = useState<string>("");

  const toggleRestriction = (id: string) => {
    setActiveRestrictions((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const formatToPublish = (assignment: Assignment) => {
    return {
      student_id:
        "E" +
        (students
          .sort((a, b) => a.name.localeCompare(b.name))
          .findIndex((s) => s.id === assignment.studentId) +
          1),
      colle_id: assignment.slotId,
    };
  };

  const handleCalculate = async () => {
    setError("");

    if (!selectedGroup) {
      setError(
        "Veuillez sélectionner un groupe d'élèves pour les colles de Physique."
      );
      return;
    }

    try {
      const { colles_counts: mathsColles } = await invoke<StudentsData>(
        "get_students",
        {
          disc: 1,
          cookie: loadSession(),
        }
      );
      const { colles_counts: physicsColles } = await invoke<StudentsData>(
        "get_students",
        {
          disc: 22,
          cookie: loadSession(),
        }
      );

      const activeRestrictionObjects = restrictions.filter((r) =>
        activeRestrictions.includes(r.id)
      );

      const assignment = computeAssignments(
        students,
        futureSlots,
        activeRestrictionObjects,
        pastColles,
        mathsColles,
        studentGroups.find((g) => g.id === selectedGroup)?.student_ids || [],
        physicsColles
      );

      setAssignment(assignment);
      setCalculated(true);

      const collesToPublish = [
        ...assignment.math.assignments.map(formatToPublish),
        ...assignment.physics.assignments.map(formatToPublish),
      ];
      saveCache("colles_to_publish", collesToPublish);
    } catch (e) {
      console.error("Assignment calculation failed:", e);
      setError(
        "Erreur : " +
          (e instanceof Error
            ? e.message
            : "Échec de la récupération des données des élèves")
      );
      return;
    }
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
                      {restriction.activity_name} ({restriction.day}{" "}
                      {restriction.start_time} - {restriction.end_time})
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Subject selection */}
          <div className="space-y-2">
            <Label>Date de début des colles à venir :</Label>
            <p className="text-sm text-muted-foreground">
              {startDate || "Non défini"}
            </p>
          </div>

          {/* Nombre de créneau de colles */}
          <div className="space-y-2">
            <Label>Nombre de créneaux de colles à venir :</Label>
            {/* Maths */}
            <p className="text-sm text-muted-foreground">
              Mathématiques :{" "}
              {futureSlots.filter((s) => s.subject === "Mathématiques").length *
                3}{" "}
            </p>
            {/* Physics */}
            <p className="text-sm text-muted-foreground">
              Physique :{" "}
              {futureSlots.filter((s) => s.subject === "Physique-Chimie")
                .length * 3}{" "}
            </p>
          </div>

          {/* Group selection */}
          <div className="space-y-2">
            <Label>Groupe d'élèves pour les colles de Physique :</Label>
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {studentGroups.map((group, i) => (
                  <SelectItem
                    key={group.id}
                    value={group.id}
                    defaultChecked={i === 0}
                  >
                    {group.name} ({group.student_ids.length} élèves)
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

      <div className="flex justify-between gap-4">
        {calculated && assignment && (
          <DownloadTimetableButton
            assignments={assignment.math.assignments}
            students={students}
            slots={futureSlots}
            title="Planning des colles - Mathématiques"
            filename="planning_colles_mathematiques.xlsx"
          />
        )}

        {calculated && assignment && (
          <DownloadTimetableButton
            assignments={assignment.physics.assignments}
            students={students}
            slots={futureSlots}
            title="Planning des colles - Physique"
            filename="planning_colles_physique.xlsx"
          />
        )}
      </div>

      {calculated && !error && (
        <Card>
          <CardHeader>
            <CardTitle>Résultats de l'attribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">
                  Colles attribuées (Maths)
                </p>
                <p className="text-2xl font-bold">
                  {assignment.math.assignments.length}/{students.length}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">
                  Colles attribuées (Physique)
                </p>
                <p className="text-2xl font-bold">
                  {assignment.physics.assignments.length}/
                  {studentGroups.find((g) => g.id === selectedGroup)
                    ?.student_ids.length || 0}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">
                  Score de distribution
                </p>
                <p className="text-2xl font-bold">
                  {assignment.math.totalScore + assignment.physics.totalScore}
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
