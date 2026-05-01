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
import { Card, CardContent } from "@/components/ui/card"
import { Pencil, Trash2, Plus } from "lucide-react"
import type { SubjectQuota, Group } from "@/types"

interface QuotaManagerProps {
  quotas: SubjectQuota[]
  setQuotas: (quotas: SubjectQuota[]) => void
  groups: Group[]
  knownSubjects?: string[]
}

export function QuotaManager({
  quotas,
  setQuotas,
  groups,
  knownSubjects = [],
}: QuotaManagerProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<{
    name: string
    subject_filter: string
    max_colles: number
    group_id: string
  }>({
    name: "",
    subject_filter: "",
    max_colles: 1,
    group_id: "",
  })

  const resetForm = () => {
    setFormData({
      name: "",
      subject_filter: "",
      max_colles: 1,
      group_id: "",
    })
    setIsAdding(false)
    setEditingId(null)
  }

  const handleAdd = async () => {
    const newQuota: SubjectQuota = {
      id: crypto.randomUUID(),
      name: formData.name,
      subject_filter: formData.subject_filter,
      max_colles: formData.max_colles,
      group_id: formData.group_id || null,
    }

    try {
      const savedQuota = await invoke<SubjectQuota>("add_subject_quota", {
        quota: newQuota,
      })
      setQuotas([...quotas, savedQuota])
      resetForm()
    } catch (error) {
      console.error("Failed to add quota:", error)
    }
  }

  const handleEdit = (quota: SubjectQuota) => {
    setFormData({
      name: quota.name,
      subject_filter: quota.subject_filter,
      max_colles: quota.max_colles,
      group_id: quota.group_id || "",
    })
    setEditingId(quota.id)
    setIsAdding(true)
  }

  const handleUpdate = async () => {
    if (!editingId) return

    const updatedQuota: SubjectQuota = {
      id: editingId,
      name: formData.name,
      subject_filter: formData.subject_filter,
      max_colles: formData.max_colles,
      group_id: formData.group_id || null,
    }

    try {
      await invoke("update_subject_quota", { quota: updatedQuota })
      setQuotas(
        quotas.map((q) => (q.id === editingId ? updatedQuota : q))
      )
      resetForm()
    } catch (error) {
      console.error("Failed to update quota:", error)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await invoke("delete_subject_quota", { id })
      setQuotas(quotas.filter((q) => q.id !== id))
    } catch (error) {
      console.error("Failed to delete quota:", error)
    }
  }

  const getGroupName = (groupId: string | null) => {
    if (!groupId) return "Tous les élèves"
    return groups.find((g) => g.id === groupId)?.name || "Groupe inconnu"
  }

  return (
    <div className="space-y-4">
      {/* Existing quotas */}
      <div className="space-y-2">
        {quotas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun quota défini
          </p>
        ) : (
          quotas.map((quota) => (
            <Card key={quota.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="font-medium">{quota.name}</div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="default">
                        Max: {quota.max_colles}
                      </Badge>
                      {quota.subject_filter && (
                        <Badge variant="outline">
                          Matière: {quota.subject_filter}
                        </Badge>
                      )}
                      <Badge variant="secondary">
                        {getGroupName(quota.group_id)}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(quota)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(quota.id)}
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
              <Label htmlFor="quota-name">Nom du quota</Label>
              <Input
                id="quota-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Ex: Quota Physique"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject-filter">
                Filtre matière (sous-chaîne)
              </Label>
              <Input
                id="subject-filter"
                list="subjects-list"
                value={formData.subject_filter}
                onChange={(e) =>
                  setFormData({ ...formData, subject_filter: e.target.value })
                }
                placeholder="Ex: Physique"
              />
              {knownSubjects.length > 0 && (
                <datalist id="subjects-list">
                  {knownSubjects.map((subject) => (
                    <option key={subject} value={subject} />
                  ))}
                </datalist>
              )}
              <p className="text-xs text-muted-foreground">
                Laissez vide pour toutes les matières
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-colles">Nombre maximum de colles</Label>
              <Input
                id="max-colles"
                type="number"
                min={1}
                value={formData.max_colles}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    max_colles: parseInt(e.target.value, 10) || 1,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="group-id">Groupe d'élèves</Label>
              <Select
                value={formData.group_id || "__all__"}
                onValueChange={(value) =>
                  setFormData({ ...formData, group_id: value === "__all__" ? "" : value })
                }
              >
                <SelectTrigger id="group-id">
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
          Ajouter un quota
        </Button>
      )}
    </div>
  )
}
