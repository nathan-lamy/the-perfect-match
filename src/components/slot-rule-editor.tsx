"use client"

import { useState } from "react"
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
import { Card, CardContent } from "@/components/ui/card"
import { Pencil, Trash2, Plus } from "lucide-react"
import type { SlotRule, SlotAction } from "@/types"

interface SlotRuleEditorProps {
  rules: SlotRule[]
  onChange: (rules: SlotRule[]) => void
  knownTeachers?: string[]
  knownSubjects?: string[]
}

export function SlotRuleEditor({
  rules,
  onChange,
  knownTeachers = [],
  knownSubjects = [],
}: SlotRuleEditorProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<{
    name: string
    match_teacher: string
    match_subject: string
    actionType: "SetCapacity" | "Ignore"
    capacity: number
  }>({
    name: "",
    match_teacher: "",
    match_subject: "",
    actionType: "SetCapacity",
    capacity: 3,
  })

  const resetForm = () => {
    setFormData({
      name: "",
      match_teacher: "",
      match_subject: "",
      actionType: "SetCapacity",
      capacity: 3,
    })
    setIsAdding(false)
    setEditingId(null)
  }

  const handleAdd = () => {
    const action: SlotAction =
      formData.actionType === "SetCapacity"
        ? { type: "SetCapacity", value: formData.capacity }
        : { type: "Ignore" }

    const newRule: SlotRule = {
      id: crypto.randomUUID(),
      name: formData.name,
      match_teacher: formData.match_teacher || null,
      match_subject: formData.match_subject || null,
      action,
    }

    onChange([...rules, newRule])
    resetForm()
  }

  const handleEdit = (rule: SlotRule) => {
    setFormData({
      name: rule.name,
      match_teacher: rule.match_teacher || "",
      match_subject: rule.match_subject || "",
      actionType: rule.action.type,
      capacity: rule.action.type === "SetCapacity" ? rule.action.value : 3,
    })
    setEditingId(rule.id)
    setIsAdding(true)
  }

  const handleUpdate = () => {
    if (!editingId) return

    const action: SlotAction =
      formData.actionType === "SetCapacity"
        ? { type: "SetCapacity", value: formData.capacity }
        : { type: "Ignore" }

    const updatedRules = rules.map((rule) =>
      rule.id === editingId
        ? {
            ...rule,
            name: formData.name,
            match_teacher: formData.match_teacher || null,
            match_subject: formData.match_subject || null,
            action,
          }
        : rule
    )

    onChange(updatedRules)
    resetForm()
  }

  const handleDelete = (id: string) => {
    onChange(rules.filter((rule) => rule.id !== id))
  }

  const renderActionBadge = (action: SlotAction) => {
    if (action.type === "Ignore") {
      return <Badge variant="destructive">Ignorer</Badge>
    }
    return (
      <Badge variant="secondary">
        Capacité: {action.value}
      </Badge>
    )
  }

  return (
    <div className="space-y-4">
      {/* Existing rules */}
      <div className="space-y-2">
        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune règle définie
          </p>
        ) : (
          rules.map((rule) => (
            <Card key={rule.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="font-medium">{rule.name}</div>
                    <div className="flex flex-wrap gap-2">
                      {rule.match_teacher && (
                        <Badge variant="outline">
                          Prof: {rule.match_teacher}
                        </Badge>
                      )}
                      {rule.match_subject && (
                        <Badge variant="outline">
                          Matière: {rule.match_subject}
                        </Badge>
                      )}
                      {renderActionBadge(rule.action)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(rule)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(rule.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add/Edit form */}
      {isAdding ? (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rule-name">Nom de la règle</Label>
              <Input
                id="rule-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Ex: Créneaux M. MOULIN"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="match-teacher">
                Professeur (exact, optionnel)
              </Label>
              <Input
                id="match-teacher"
                list="teachers-list"
                value={formData.match_teacher}
                onChange={(e) =>
                  setFormData({ ...formData, match_teacher: e.target.value })
                }
                placeholder="Ex: M. MOULIN"
              />
              {knownTeachers.length > 0 && (
                <datalist id="teachers-list">
                  {knownTeachers.map((teacher) => (
                    <option key={teacher} value={teacher} />
                  ))}
                </datalist>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="match-subject">
                Matière (sous-chaîne, optionnel)
              </Label>
              <Input
                id="match-subject"
                list="subjects-list"
                value={formData.match_subject}
                onChange={(e) =>
                  setFormData({ ...formData, match_subject: e.target.value })
                }
                placeholder="Ex: Mathématiques"
              />
              {knownSubjects.length > 0 && (
                <datalist id="subjects-list">
                  {knownSubjects.map((subject) => (
                    <option key={subject} value={subject} />
                  ))}
                </datalist>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="action-type">Action</Label>
              <Select
                value={formData.actionType}
                onValueChange={(value: "SetCapacity" | "Ignore") =>
                  setFormData({ ...formData, actionType: value })
                }
              >
                <SelectTrigger id="action-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SetCapacity">
                    Définir la capacité
                  </SelectItem>
                  <SelectItem value="Ignore">Ignorer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.actionType === "SetCapacity" && (
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacité</Label>
                <Input
                  id="capacity"
                  type="number"
                  min={1}
                  value={formData.capacity}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      capacity: parseInt(e.target.value, 10) || 1,
                    })
                  }
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={editingId ? handleUpdate : handleAdd}
                disabled={!formData.name}
              >
                {editingId ? "Mettre à jour" : "Ajouter"}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => setIsAdding(true)} variant="outline" className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Ajouter une règle
        </Button>
      )}
    </div>
  )
}
