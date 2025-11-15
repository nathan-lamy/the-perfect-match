"use client";

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
  CollesCount,
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
import { AlertCircle, Loader2 } from "lucide-react";
import { loadCache, loadSession, saveCache } from "@/lib/utils";
import { invoke } from "@tauri-apps/api/core";
import { DownloadTimetableButton } from "@/lib/export";
import { Input } from "@/components/ui/input";

interface Step3AssignmentProps {
  onNext: () => void;
}

// Rust assignment result types
interface RustAssignment {
  student_id: string;
  slot_id: string | null;
}

interface RustAssignmentResult {
  assignments: RustAssignment[];
  total_score: number;
}

interface RustComputeResult {
  math: RustAssignmentResult;
  physics: RustAssignmentResult;
}

const DEFAULT_ATTEMPTS = 100;

export function Step3Assignment({ onNext }: Step3AssignmentProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [restrictions, setRestrictions] = useState<Restriction[]>([]);
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([]);
  const [futureSlots, setFutureSlots] = useState<FutureSlot[]>([]);
  const [pastColles, setPastColles] = useState<PastColle[]>([]);
  const [startDate, setStartDate] = useState("");

  const [numAttempts, setNumAttempts] = useState<number>(DEFAULT_ATTEMPTS);
  const [computing, setComputing] = useState(false);

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
  const [assignment, setAssignment] = useState<RustComputeResult | null>(null);
  const [error, setError] = useState<string>("");
  const [computationTime, setComputationTime] = useState<number>(0);

  const toggleRestriction = (id: string) => {
    setActiveRestrictions((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const formatToPublish = (rustAssignment: RustAssignment) => {
    return {
      student_id:
        "E" +
        (students
          .sort((a, b) => a.name.localeCompare(b.name))
          .findIndex((s) => s.id === rustAssignment.student_id) +
          1),
      colle_id: rustAssignment.slot_id,
    };
  };

  const handleCalculate = async () => {
    setError("");
    setComputing(true);
    setCalculated(false);

    if (!selectedGroup) {
      setError(
        "Veuillez sélectionner un groupe d'élèves pour les colles de Physique."
      );
      setComputing(false);
      return;
    }

    try {
      // Fetch student data
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

      // Prepare data for Rust
      const activeRestrictionObjects = restrictions.filter((r) =>
        activeRestrictions.includes(r.id)
      );

      const physGroup =
        studentGroups.find((g) => g.id === selectedGroup)?.student_ids || [];

      console.log("Calling Rust assignment computation with:", {
        studentsCount: students.length,
        slotsCount: futureSlots.length,
        restrictionsCount: activeRestrictionObjects.length,
        pastCollesCount: pastColles.length,
        physGroupSize: physGroup.length,
        attempts: numAttempts,
      });

      // Create a map colles functions that replace data.student (type Student) to student full name (last + first)
      function cleanNames(colles: CollesCount): CollesCount {
        return {
          header: colles.header,
          data: colles.data.map(({ student, counts }) => ({
            // @ts-expect-error TODO: Fix wrong Rust types
            student: `${student.last_name} ${student.first_name}`,
            counts,
          })),
        };
      }

      // Fix date format for Rust
      const futureSlotsTransformed = futureSlots.map(slot => ({
        ...slot,
        date: slot.date.replace(/\//g, '-'), // Remplacer / par -
      }));

      // TODO: Remove debug
      console.log(cleanNames(mathsColles));
      console.log(futureSlotsTransformed);

      // Call Rust function via Tauri
      const startTime = Date.now();
      const result = await invoke<RustComputeResult>("compute_assignment", {
        students,
        slots: futureSlotsTransformed,
        restrictions: activeRestrictionObjects,
        pastColles,
        mathCount: cleanNames(mathsColles),
        physGroup,
        physCount: cleanNames(physicsColles),
        n: numAttempts,
      });

      const elapsedTime = (Date.now() - startTime) / 1000;
      setComputationTime(elapsedTime);

      console.log("Rust assignment completed:", {
        mathAssignments: result.math.assignments.length,
        physicsAssignments: result.physics.assignments.length,
        mathScore: result.math.total_score,
        physicsScore: result.physics.total_score,
        totalScore: result.math.total_score + result.physics.total_score,
        timeSeconds: elapsedTime,
      });

      setAssignment(result);
      setCalculated(true);

      // Save assignments for publishing
      const collesToPublish = [
        ...result.math.assignments
          .filter(a => a.slot_id !== null)
          .map(formatToPublish),
        ...result.physics.assignments
          .filter(a => a.slot_id !== null)
          .map(formatToPublish),
      ];
      saveCache("colles_to_publish", collesToPublish);

      // Also save the raw data for Step 4
      saveCache("students", students);
      saveCache("future_slots", futureSlots);
      saveCache("restrictions", activeRestrictionObjects);
      saveCache("past_colles", pastColles);
      saveCache("math_count", mathsColles);
      saveCache("phys_group", physGroup);
      saveCache("phys_count", physicsColles);

    } catch (e) {
      console.error("Assignment calculation failed:", e);
      setError(
        "Erreur lors du calcul de l'attribution : " +
        (e instanceof Error
          ? e.message
          : "Échec inattendu. Vérifiez les logs de la console.")
      );
    } finally {
      setComputing(false);
    }
  };

  // Calculate stats
  const mathSlotsCount = futureSlots.filter(
    (s) => s.subject.includes("Mathématiques") && s.teacher !== "M. MOULIN"
  ).length * 3 +
    futureSlots.filter(
      (s) => s.subject.includes("Mathématiques") && s.teacher === "M. MOULIN"
    ).length;

  const physicsSlotsCount = futureSlots.filter(
    (s) => s.subject === "Physique-Chimie"
  ).length * 3;

  const selectedGroupSize =
    studentGroups.find((g) => g.id === selectedGroup)?.student_ids.length || 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Étape 3 : Attribuer les colles</CardTitle>
          <CardDescription>
            Configurez les paramètres d'attribution et calculez la répartition
            optimale avec l'algorithme Rust
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
                      disabled={computing}
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

          {/* Date info */}
          <div className="space-y-2">
            <Label>Date de début des colles à venir :</Label>
            <p className="text-sm text-muted-foreground">
              {startDate || "Non défini"}
            </p>
          </div>

          {/* Slots count */}
          <div className="space-y-2">
            <Label>Nombre de créneaux de colles à venir :</Label>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Mathématiques : {mathSlotsCount} places
              </p>
              <p className="text-sm text-muted-foreground">
                Physique : {physicsSlotsCount} places
              </p>
            </div>
          </div>

          {/* Group selection */}
          <div className="space-y-2">
            <Label>Groupe d'élèves pour les colles de Physique :</Label>
            <Select
              value={selectedGroup}
              onValueChange={setSelectedGroup}
              disabled={computing}
            >
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

          {/* Attempts input */}
          <div className="space-y-2">
            <Label>Nombre de tentatives parallèles :</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={100}
                value={numAttempts}
                onChange={(e) =>
                  setNumAttempts(parseInt(e.target.value) || DEFAULT_ATTEMPTS)
                }
                className="w-24"
                disabled={computing}
              />
              <span className="text-sm text-muted-foreground">
                (recommandé : 10-20)
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              L'algorithme calcule {numAttempts} attributions en parallèle
              et sélectionne la meilleure. Temps estimé : ~
              {Math.ceil(numAttempts / 2)}-{Math.ceil(numAttempts)}s
            </p>
          </div>

          {/* Error display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Validation warnings */}
          {mathSlotsCount < students.length && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Attention : Il n'y a que {mathSlotsCount} places en maths pour{" "}
                {students.length} élèves. Certains élèves ne seront pas
                assignés.
              </AlertDescription>
            </Alert>
          )}

          {physicsSlotsCount < selectedGroupSize && selectedGroup && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Attention : Il n'y a que {physicsSlotsCount} places en physique
                pour {selectedGroupSize} élèves. Certains élèves ne seront pas
                assignés.
              </AlertDescription>
            </Alert>
          )}

          {/* Calculate button */}
          <Button
            onClick={handleCalculate}
            disabled={computing || !selectedGroup}
            className="w-full"
          >
            {computing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Calcul en cours... ({numAttempts} tentatives)
              </>
            ) : (
              "🚀 Calculer l'attribution"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Download buttons */}
      {calculated && assignment && (
        <div className="flex justify-between gap-4">
          <DownloadTimetableButton
            assignments={assignment.math.assignments.map(a => ({
              studentId: a.student_id,
              slotId: a.slot_id!,
              score: 0,
            }))}
            students={students}
            slots={futureSlots}
            title="Planning des colles - Mathématiques"
            filename="planning_colles_mathematiques.xlsx"
          />

          <DownloadTimetableButton
            assignments={assignment.physics.assignments.map(a => ({
              studentId: a.student_id,
              slotId: a.slot_id!,
              score: 0,
            }))}
            students={students}
            slots={futureSlots}
            title="Planning des colles - Physique"
            filename="planning_colles_physique.xlsx"
          />
        </div>
      )}

      {/* Results */}
      {calculated && !error && assignment && (
        <Card>
          <CardHeader>
            <CardTitle>✅ Résultats de l'attribution</CardTitle>
            <CardDescription>
              Calcul effectué en {computationTime.toFixed(2)}s avec{" "}
              {numAttempts} tentatives parallèles
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  Colles Maths
                </p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {assignment.math.assignments.filter(a => a.slot_id !== null).length}/
                  {students.length}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-600 dark:text-green-400">
                  Colles Physique
                </p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {assignment.physics.assignments.filter(a => a.slot_id !== null).length}/
                  {selectedGroupSize}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800">
                <p className="text-sm text-purple-600 dark:text-purple-400">
                  Score total
                </p>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {(assignment.math.total_score +
                    assignment.physics.total_score).toLocaleString()}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800">
                <p className="text-sm text-orange-600 dark:text-orange-400">
                  Temps de calcul
                </p>
                <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                  {computationTime.toFixed(1)}s
                </p>
              </div>
            </div>

            {/* Detailed scores */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <p className="text-sm font-medium mb-2">Détails Mathématiques</p>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>Score : {assignment.math.total_score.toLocaleString()}</p>
                  <p>Assignments : {assignment.math.assignments.length}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Détails Physique</p>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>Score : {assignment.physics.total_score.toLocaleString()}</p>
                  <p>Assignments : {assignment.physics.assignments.length}</p>
                </div>
              </div>
            </div>

            <Button onClick={onNext} className="w-full" size="lg">
              ➡️ Passer à la publication
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
