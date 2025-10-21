"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StudentGroup, Student } from "@/types";
import { Plus, Trash2, Edit2, X, Check, Users } from "lucide-react";
import { StudentCombobox } from "@/components/student-combobox";
import { invoke } from "@tauri-apps/api/core";

interface GroupManagerProps {
  groups: StudentGroup[];
  setGroups: (groups: StudentGroup[]) => void;
  students: Student[];
}

export function GroupManager({
  groups,
  setGroups,
  students,
}: GroupManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    student_ids: [] as string[],
  });

  const handleSubmit = async () => {
    if (!formData.name || formData.student_ids.length === 0) return;

    if (editingId) {
      await invoke("update_group", {
        id: editingId,
        name: formData.name,
        studentIds: formData.student_ids,
      }).catch((err) => {
        console.error("Failed to update group:", err);
      });
      setGroups(
        groups.map((g) =>
          g.id === editingId ? { ...formData, id: editingId } : g
        )
      );
      setEditingId(null);
    } else {
      const newGroup: StudentGroup = await invoke("add_group", {
        name: formData.name,
        studentIds: formData.student_ids,
      });
      setGroups([...groups, newGroup]);
    }

    setFormData({ name: "", student_ids: [] });
    setIsAdding(false);
  };

  const handleEdit = (group: StudentGroup) => {
    setFormData(group);
    setEditingId(group.id);
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    await invoke("delete_group", { id }).catch((err) => {
      console.error("Failed to delete group:", err);
    });
    setGroups(groups.filter((g) => g.id !== id));
  };

  const handleCancel = () => {
    setFormData({ name: "", student_ids: [] });
    setIsAdding(false);
    setEditingId(null);
  };

  const toggleStudent = (studentId: string) => {
    setFormData((prev) => ({
      ...prev,
      student_ids: prev.student_ids.includes(studentId)
        ? prev.student_ids.filter((id) => id !== studentId)
        : [...prev.student_ids, studentId],
    }));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Groupes d'élèves</CardTitle>
          {!isAdding && (
            <Button onClick={() => setIsAdding(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Ajouter
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdding && (
          <div className="p-4 border border-border rounded-lg space-y-4">
            <div className="space-y-2">
              <Label>Nom du groupe</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Ex: Groupe A, MPSI..."
              />
            </div>
            <div className="space-y-2">
              <Label>Élèves du groupe</Label>
              <StudentCombobox
                students={students}
                selectedStudentIds={formData.student_ids}
                onStudentToggle={toggleStudent}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSubmit} size="sm">
                <Check className="w-4 h-4 mr-2" />
                {editingId ? "Modifier" : "Créer"}
              </Button>
              <Button onClick={handleCancel} variant="outline" size="sm">
                <X className="w-4 h-4 mr-2" />
                Annuler
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {groups.map((group) => (
            <div
              key={group.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{group.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {group.student_ids.length} élève(s)
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleEdit(group)}
                  variant="ghost"
                  size="sm"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => handleDelete(group.id)}
                  variant="ghost"
                  size="sm"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          {groups.length === 0 && !isAdding && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucun groupe créé
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
