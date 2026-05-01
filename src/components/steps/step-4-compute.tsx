"use client"

import { useEffect, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Loader2 } from "lucide-react"
import { QuotaTracker } from "@/components/quota-tracker"
import { loadCache, saveCache } from "@/lib/utils"
import type {
  Student,
  Slot,
  Restriction,
  PastColle,
  Group,
  SubjectQuota,
  SlotRule,
  Weights,
  ComputeResult,
  ColleToPublish,
  AssignmentPass,
  CollesCount,
} from "@/types"
import { DEFAULT_WEIGHTS } from "@/types"

interface Step4ComputeProps {
  onNext: () => void
}

export function Step4Compute({ onNext }: Step4ComputeProps) {
  const [computing, setComputing] = useState(false)
  const [computed, setComputed] = useState(false)
  const [error, setError] = useState<string>("")
  const [result, setResult] = useState<ComputeResult | null>(null)
  const [computationTime, setComputationTime] = useState<number>(0)

  const [students, setStudents] = useState<Student[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [restrictions, setRestrictions] = useState<Restriction[]>([])
  const [pastColles, setPastColles] = useState<PastColle[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [quotas, setQuotas] = useState<SubjectQuota[]>([])
  const [globalRules, setGlobalRules] = useState<SlotRule[]>([])
  const [globalWeights, setGlobalWeights] = useState<Weights | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [loadedStudents, loadedRestrictions, loadedGroups] = await Promise.all([
          invoke<Student[]>("load_students"),
          invoke<Restriction[]>("load_restrictions"),
          invoke<Group[]>("load_groups"),
        ])

        // Add name field to students
        const studentsWithNames = loadedStudents.map((s) => ({
          ...s,
          name: `${s.last_name} ${s.first_name}`,
        }))

        setStudents(studentsWithNames)
        setRestrictions(loadedRestrictions)
        setGroups(loadedGroups)

        // Load from cache
        const cachedSlots = loadCache<Slot[]>("future_slots") || []
        const cachedPastColles = loadCache<PastColle[]>("last_week") || []
        const cachedQuotas = loadCache<SubjectQuota[]>("subject_quotas") || []
        const cachedRules = loadCache<SlotRule[]>("global_slot_rules") || []
        const cachedWeights = loadCache<Weights>("global_weights")

        setSlots(cachedSlots)
        setPastColles(cachedPastColles)
        setQuotas(cachedQuotas)
        setGlobalRules(cachedRules)
        setGlobalWeights(cachedWeights)
      } catch (error) {
        console.error("Failed to load data:", error)
      }
    }

    loadData()
  }, [])

  const handleCompute = async () => {
    setComputing(true)
    setError("")

    try {
      const startTime = Date.now()

      // Load passes from cache
      const cachedPasses = loadCache<AssignmentPass[]>("assignment_passes") || []
      
      // Build colles count from past colles
      const collesCount: CollesCount = {
        header: [],
        data: [],
      }

      const computeResult = await invoke<ComputeResult>("compute_assignment", {
        students,
        slots,
        restrictions,
        pastColles,
        collesCount,
        globalRules,
        globalWeights: globalWeights || DEFAULT_WEIGHTS,
        passes: cachedPasses,
        groups,
        quotas,
        n: 10, // Number of parallel attempts
      })

      const elapsedTime = (Date.now() - startTime) / 1000
      setComputationTime(elapsedTime)
      setResult(computeResult)
      setComputed(true)

      // Prepare data for publishing
      const collesToPublish: ColleToPublish[] = computeResult.passes.flatMap((pass) =>
        pass.assignments
          .filter((a) => a.slot_id !== null)
          .map((a) => ({
            student_id: `E${students.findIndex((s) => s.id === a.student_id) + 1}`,
            colle_id: a.slot_id!,
          }))
      )

      saveCache("colles_to_publish", collesToPublish)
    } catch (err) {
      console.error("Computation failed:", err)
      setError(
        "Erreur lors du calcul : " +
          (err instanceof Error ? err.message : String(err))
      )
    } finally {
      setComputing(false)
    }
  }

  const totalAssigned = result?.passes.reduce(
    (sum, pass) => sum + pass.assignments.filter((a) => a.slot_id !== null).length,
    0
  ) || 0

  const totalUnassigned = result?.passes.reduce(
    (sum, pass) => sum + pass.unassigned_student_ids.length,
    0
  ) || 0

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Calcul de l'attribution</CardTitle>
          <CardDescription>
            Lancez le calcul de l'attribution optimale
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Pre-flight summary */}
          {!computed && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium">Résumé de la configuration</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Élèves :</span>{" "}
                    {students.length}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Créneaux :</span>{" "}
                    {slots.length}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Restrictions :</span>{" "}
                    {restrictions.length}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Quotas :</span>{" "}
                    {quotas.length}
                  </div>
                </div>
              </div>

              {quotas.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {quotas.map((quota) => (
                    <Badge key={quota.id} variant="outline">
                      {quota.name}: max {quota.max_colles}
                    </Badge>
                  ))}
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleCompute}
                disabled={computing || students.length === 0 || slots.length === 0}
                className="w-full"
              >
                {computing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Calcul en cours...
                  </>
                ) : (
                  "🚀 Lancer le calcul"
                )}
              </Button>
            </div>
          )}

          {/* Results */}
          {computed && result && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                  <p className="text-sm text-green-600 dark:text-green-400">
                    Assignés
                  </p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {totalAssigned}
                  </p>
                </div>

                <div
                  className={`p-4 rounded-lg border ${
                    totalUnassigned > 0
                      ? "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
                      : "bg-muted border-border"
                  }`}
                >
                  <p
                    className={`text-sm ${
                      totalUnassigned > 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-muted-foreground"
                    }`}
                  >
                    Non assignés
                  </p>
                  <p
                    className={`text-2xl font-bold ${
                      totalUnassigned > 0
                        ? "text-red-700 dark:text-red-300"
                        : "text-muted-foreground"
                    }`}
                  >
                    {totalUnassigned}
                  </p>
                </div>

                <div
                  className={`p-4 rounded-lg border ${
                    result.quota_violations.length > 0
                      ? "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800"
                      : "bg-muted border-border"
                  }`}
                >
                  <p
                    className={`text-sm ${
                      result.quota_violations.length > 0
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-muted-foreground"
                    }`}
                  >
                    {result.quota_violations.length > 0
                      ? "Quotas dépassés"
                      : "Quotas OK"}
                  </p>
                  <p
                    className={`text-2xl font-bold ${
                      result.quota_violations.length > 0
                        ? "text-amber-700 dark:text-amber-300"
                        : "text-muted-foreground"
                    }`}
                  >
                    {result.quota_violations.length}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800">
                  <p className="text-sm text-purple-600 dark:text-purple-400">
                    Temps
                  </p>
                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                    {computationTime.toFixed(1)}s
                  </p>
                </div>
              </div>

              <Button onClick={onNext} className="w-full" size="lg">
                ➡️ Passer à la publication
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quota tracker */}
      {computed &&
        result &&
        quotas.length > 0 &&
        result.quota_progress.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Suivi des quotas</CardTitle>
            </CardHeader>
            <CardContent>
              <QuotaTracker
                progress={result.quota_progress}
                violations={result.quota_violations}
                students={students}
                quotas={quotas}
                groups={groups}
              />
            </CardContent>
          </Card>
        )}
    </div>
  )
}
