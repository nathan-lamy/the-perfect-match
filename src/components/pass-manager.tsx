"use client"

import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { SlotRuleEditor } from "@/components/slot-rule-editor"
import { WeightsEditor } from "@/components/weights-editor"
import { Plus, Trash2, ChevronUp, ChevronDown, ChevronRight, ChevronDown as ChevronDownIcon } from "lucide-react"
import type { AssignmentPass, Group, Slot, Student } from "@/types"
import { DEFAULT_WEIGHTS } from "@/types"

interface PassManagerProps {
  passes: AssignmentPass[]
  setPasses: (passes: AssignmentPass[]) => void
  groups: Group[]
  slots: Slot[]
  students: Student[]
  knownTeachers: string[]
  knownSubjects: string[]
}

export function PassManager({
  passes,
  setPasses,
  groups,
  slots,
  students,
  knownTeachers,
  knownSubjects,
}: PassManagerProps) {
  const [expandedPassId, setExpandedPassId] = useState<string | null>(null)

  const handleAddPass = async () => {
    const newPass: AssignmentPass = {
      id: crypto.randomUUID(),
      name: `Passe ${passes.length + 1}`,
      slot_subject_filter: "",
      student_group_id: null,
      weights: null,
      slot_rules: [],
      ignored_slot_ids: [],
      ignored_student_ids: [],
      priority: passes.length,
    }

    try {
      const savedPass = await invoke<AssignmentPass>("add_assignment_pass", {
        pass: newPass,
      })
      setPasses([...passes, savedPass])
      setExpandedPassId(savedPass.id)
    } catch (error) {
      console.error("Failed to add pass:", error)
    }
  }

  const handleUpdatePass = async (updatedPass: AssignmentPass) => {
    try {
      await invoke("update_assignment_pass", { pass: updatedPass })
      setPasses(passes.map((p) => (p.id === updatedPass.id ? updatedPass : p)))
    } catch (error) {
      console.error("Failed to update pass:", error)
    }
  }

  const handleDeletePass = async (id: string) => {
    try {
      await invoke("delete_assignment_pass", { id })
      setPasses(passes.filter((p) => p.id !== id))
    } catch (error) {
      console.error("Failed to delete pass:", error)
    }
  }

  const handleMoveUp = async (index: number) => {
    if (index === 0) return
    const newPasses = [...passes]
    ;[newPasses[index - 1], newPasses[index]] = [newPasses[index], newPasses[index - 1]]
    
    // Update priorities
    newPasses.forEach((pass, i) => {
      pass.priority = i
    })

    try {
      await invoke("reorder_assignment_passes", {
        orderedIds: newPasses.map((p) => p.id),
      })
      setPasses(newPasses)
    } catch (error) {
      console.error("Failed to reorder passes:", error)
    }
  }

  const handleMoveDown = async (index: number) => {
    if (index === passes.length - 1) return
    const newPasses = [...passes]
    ;[newPasses[index], newPasses[index + 1]] = [newPasses[index + 1], newPasses[index]]
    
    // Update priorities
    newPasses.forEach((pass, i) => {
      pass.priority = i
    })

    try {
      await invoke("reorder_assignment_passes", {
        orderedIds: newPasses.map((p) => p.id),
      })
      setPasses(newPasses)
    } catch (error) {
      console.error("Failed to reorder passes:", error)
    }
  }

  const getMatchingSlots = (pass: AssignmentPass) => {
    return slots.filter((slot) => {
      if (pass.slot_subject_filter && !slot.subject.includes(pass.slot_subject_filter)) {
        return false
      }
      if (pass.ignored_slot_ids.includes(slot.id)) {
        return false
      }
      return true
    })
  }

  const getGroupStudentCount = (groupId: string | null) => {
    if (!groupId) return students.length
    const group = groups.find((g) => g.id === groupId)
    return group ? group.student_ids.length : 0
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Les passes d'attribution seront exécutées séquentiellement dans l'ordre de priorité.
      </div>

      {passes.length === 0 ? (
        <div className="p-8 text-center border rounded-lg bg-muted/50">
          <p className="text-sm text-muted-foreground mb-4">
            Aucune passe configurée. Ajoutez une passe pour commencer.
          </p>
          <Button onClick={handleAddPass}>
            <Plus className="mr-2 h-4 w-4" />
            Ajouter une passe
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {passes.map((pass, index) => {
              const isExpanded = expandedPassId === pass.id
              const matchingSlots = getMatchingSlots(pass)
              const studentCount = getGroupStudentCount(pass.student_group_id)

              return (
                <Card key={pass.id}>
                  <CardHeader className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setExpandedPassId(isExpanded ? null : pass.id)
                          }
                        >
                          {isExpanded ? (
                            <ChevronDownIcon className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                        <div className="flex-1">
                          <CardTitle className="text-base">{pass.name}</CardTitle>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              Priorité: {pass.priority}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {matchingSlots.length} créneaux
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {studentCount} élèves
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleMoveDown(index)}
                          disabled={index === passes.length - 1}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeletePass(pass.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="p-4 pt-0">
                      <Tabs defaultValue="general" className="w-full">
                        <TabsList className="grid w-full grid-cols-4">
                          <TabsTrigger value="general">Général</TabsTrigger>
                          <TabsTrigger value="rules">Règles créneaux</TabsTrigger>
                          <TabsTrigger value="weights">Poids</TabsTrigger>
                          <TabsTrigger value="exclude">Exclure</TabsTrigger>
                        </TabsList>

                        <TabsContent value="general" className="space-y-4 mt-4">
                          <div className="space-y-2">
                            <Label htmlFor={`pass-name-${pass.id}`}>Nom de la passe</Label>
                            <Input
                              id={`pass-name-${pass.id}`}
                              value={pass.name}
                              onChange={(e) =>
                                handleUpdatePass({ ...pass, name: e.target.value })
                              }
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`subject-filter-${pass.id}`}>
                              Filtre matière (sous-chaîne)
                            </Label>
                            <Input
                              id={`subject-filter-${pass.id}`}
                              list={`subjects-list-${pass.id}`}
                              value={pass.slot_subject_filter}
                              onChange={(e) =>
                                handleUpdatePass({
                                  ...pass,
                                  slot_subject_filter: e.target.value,
                                })
                              }
                              placeholder="Ex: Mathématiques"
                            />
                            {knownSubjects.length > 0 && (
                              <datalist id={`subjects-list-${pass.id}`}>
                                {knownSubjects.map((subject) => (
                                  <option key={subject} value={subject} />
                                ))}
                              </datalist>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`group-${pass.id}`}>Groupe d'élèves</Label>
                            <Select
                              value={pass.student_group_id || "__all__"}
                              onValueChange={(value) =>
                                handleUpdatePass({
                                  ...pass,
                                  student_group_id: value === "__all__" ? null : value,
                                })
                              }
                            >
                              <SelectTrigger id={`group-${pass.id}`}>
                                <SelectValue placeholder="Tous les élèves" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__all__">Tous les élèves</SelectItem>
                                {groups.map((group) => (
                                  <SelectItem key={group.id} value={group.id}>
                                    {group.name} ({group.student_ids.length} élèves)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </TabsContent>

                        <TabsContent value="rules" className="mt-4">
                          <SlotRuleEditor
                            rules={pass.slot_rules}
                            onChange={(rules) =>
                              handleUpdatePass({ ...pass, slot_rules: rules })
                            }
                            knownTeachers={knownTeachers}
                            knownSubjects={knownSubjects}
                          />
                        </TabsContent>

                        <TabsContent value="weights" className="space-y-4 mt-4">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`custom-weights-${pass.id}`}
                              checked={pass.weights !== null}
                              onCheckedChange={(checked) =>
                                handleUpdatePass({
                                  ...pass,
                                  weights: checked ? DEFAULT_WEIGHTS : null,
                                })
                              }
                            />
                            <Label htmlFor={`custom-weights-${pass.id}`}>
                              Utiliser des poids personnalisés pour cette passe
                            </Label>
                          </div>

                          {pass.weights && (
                            <WeightsEditor
                              weights={pass.weights}
                              onChange={(weights) =>
                                handleUpdatePass({ ...pass, weights })
                              }
                            />
                          )}

                          {!pass.weights && (
                            <p className="text-sm text-muted-foreground">
                              Cette passe utilisera les poids globaux
                            </p>
                          )}
                        </TabsContent>

                        <TabsContent value="exclude" className="space-y-4 mt-4">
                          <div className="space-y-2">
                            <Label>Créneaux exclus</Label>
                            <div className="max-h-[300px] overflow-y-auto border rounded-lg p-4 space-y-2">
                              {matchingSlots.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  Aucun créneau correspondant
                                </p>
                              ) : (
                                matchingSlots.map((slot) => (
                                  <div
                                    key={slot.id}
                                    className="flex items-center space-x-2"
                                  >
                                    <Checkbox
                                      id={`slot-${pass.id}-${slot.id}`}
                                      checked={!pass.ignored_slot_ids.includes(slot.id)}
                                      onCheckedChange={(checked) => {
                                        const newIgnored = checked
                                          ? pass.ignored_slot_ids.filter(
                                              (id) => id !== slot.id
                                            )
                                          : [...pass.ignored_slot_ids, slot.id]
                                        handleUpdatePass({
                                          ...pass,
                                          ignored_slot_ids: newIgnored,
                                        })
                                      }}
                                    />
                                    <Label
                                      htmlFor={`slot-${pass.id}-${slot.id}`}
                                      className="text-sm font-normal cursor-pointer"
                                    >
                                      {slot.subject} — {slot.teacher} — {slot.date}{" "}
                                      {slot.start_hour}-{slot.end_hour}
                                    </Label>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>Élèves exclus</Label>
                            <div className="max-h-[300px] overflow-y-auto border rounded-lg p-4 space-y-2">
                              {students.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  Aucun élève
                                </p>
                              ) : (
                                students.map((student) => (
                                  <div
                                    key={student.id}
                                    className="flex items-center space-x-2"
                                  >
                                    <Checkbox
                                      id={`student-${pass.id}-${student.id}`}
                                      checked={
                                        !pass.ignored_student_ids.includes(student.id)
                                      }
                                      onCheckedChange={(checked) => {
                                        const newIgnored = checked
                                          ? pass.ignored_student_ids.filter(
                                              (id) => id !== student.id
                                            )
                                          : [...pass.ignored_student_ids, student.id]
                                        handleUpdatePass({
                                          ...pass,
                                          ignored_student_ids: newIgnored,
                                        })
                                      }}
                                    />
                                    <Label
                                      htmlFor={`student-${pass.id}-${student.id}`}
                                      className="text-sm font-normal cursor-pointer"
                                    >
                                      {student.name}
                                    </Label>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>

          <Button onClick={handleAddPass} variant="outline" className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Ajouter une passe
          </Button>
        </>
      )}
    </div>
  )
}
