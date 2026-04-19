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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SlotRuleEditor } from "@/components/slot-rule-editor"
import { WeightsEditor } from "@/components/weights-editor"
import { QuotaManager } from "@/components/quota-manager"
import { PassManager } from "@/components/pass-manager"
import { loadCache, saveCache } from "@/lib/utils"
import type {
  AssignmentPass,
  SlotRule,
  Weights,
  SubjectQuota,
  Group,
  Slot,
  Student,
} from "@/types"
import { DEFAULT_WEIGHTS } from "@/types"

interface Step3PipelineProps {
  onNext: () => void
}

export function Step3Pipeline({ onNext }: Step3PipelineProps) {
  const [passes, setPasses] = useState<AssignmentPass[]>([])
  const [globalRules, setGlobalRules] = useState<SlotRule[]>([])
  const [globalWeights, setGlobalWeights] = useState<Weights>(DEFAULT_WEIGHTS)
  const [quotas, setQuotas] = useState<SubjectQuota[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [students, setStudents] = useState<Student[]>([])

  useEffect(() => {
    // Load data from backend and cache
    const loadData = async () => {
      try {
        const [loadedGroups, loadedRules, loadedWeights, loadedQuotas, loadedPasses, loadedStudents] =
          await Promise.all([
            invoke<Group[]>("load_groups"),
            invoke<SlotRule[]>("load_slot_rules"),
            invoke<Weights>("load_global_weights"),
            invoke<SubjectQuota[]>("load_subject_quotas"),
            invoke<AssignmentPass[]>("load_assignment_passes"),
            invoke<Student[]>("load_students"),
          ])

        setGroups(loadedGroups)
        setGlobalRules(loadedRules)
        setGlobalWeights(loadedWeights)
        setQuotas(loadedQuotas)
        setPasses(loadedPasses)
        setStudents(loadedStudents)
      } catch (error) {
        console.error("Failed to load data:", error)
      }

      // Load slots from cache
      const cachedSlots = loadCache<Slot[]>("future_slots") || []
      setSlots(cachedSlots)
    }

    loadData()
  }, [])

  const handleContinue = async () => {
    // Save to backend
    try {
      await invoke("save_global_weights", { weights: globalWeights })
    } catch (error) {
      console.error("Failed to save global weights:", error)
    }

    // Save to cache for step 4
    saveCache("assignment_passes", passes)
    saveCache("global_slot_rules", globalRules)
    saveCache("global_weights", globalWeights)
    saveCache("subject_quotas", quotas)

    onNext()
  }

  // Extract unique teachers and subjects from slots
  const knownTeachers = Array.from(new Set(slots.map((s) => s.teacher))).sort()
  const knownSubjects = Array.from(new Set(slots.map((s) => s.subject))).sort()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuration du pipeline d'attribution</CardTitle>
        <CardDescription>
          Configurez les passes d'attribution, les règles globales et les quotas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="passes" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="passes">Passes</TabsTrigger>
            <TabsTrigger value="global">Règles globales & Poids</TabsTrigger>
            <TabsTrigger value="quotas">Quotas</TabsTrigger>
          </TabsList>

          <TabsContent value="passes" className="space-y-4 mt-4">
            <PassManager
              passes={passes}
              setPasses={setPasses}
              groups={groups}
              slots={slots}
              students={students}
              knownTeachers={knownTeachers}
              knownSubjects={knownSubjects}
            />
          </TabsContent>

          <TabsContent value="global" className="space-y-4 mt-4">
            <Tabs defaultValue="rules" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="rules">Règles créneaux</TabsTrigger>
                <TabsTrigger value="weights">Poids</TabsTrigger>
              </TabsList>

              <TabsContent value="rules" className="mt-4">
                <SlotRuleEditor
                  rules={globalRules}
                  onChange={setGlobalRules}
                  knownTeachers={knownTeachers}
                  knownSubjects={knownSubjects}
                />
              </TabsContent>

              <TabsContent value="weights" className="mt-4">
                <WeightsEditor
                  weights={globalWeights}
                  onChange={setGlobalWeights}
                />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="quotas" className="space-y-4 mt-4">
            <div className="text-sm text-muted-foreground">
              Les quotas limitent le nombre de colles par matière pour chaque élève.
              Ils génèrent des avertissements mais ne bloquent pas l'algorithme.
            </div>
            <QuotaManager
              quotas={quotas}
              setQuotas={setQuotas}
              groups={groups}
              knownSubjects={knownSubjects}
            />
          </TabsContent>
        </Tabs>

        <div className="mt-6">
          <Button onClick={handleContinue} className="w-full">
            Continuer vers le calcul
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
