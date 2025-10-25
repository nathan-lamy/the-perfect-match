import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Restriction, Student } from "@/types";
import { Plus, Trash2, Edit2, X, Check } from "lucide-react";
import { StudentCombobox } from "@/components/student-combobox";
import { invoke } from "@tauri-apps/api/core";
import { Select, SelectContent, SelectValue, SelectTrigger, SelectItem } from "@/components/ui/select";

interface RestrictionManagerProps {
  restrictions: Restriction[];
  setRestrictions: (restrictions: Restriction[]) => void;
  students: Student[];
}

export function RestrictionManager({
  restrictions,
  setRestrictions,
  students,
}: RestrictionManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    startTime: "15:00",
    endTime: "18:00",
    studentIds: [] as string[],
    day: "",
  });

  const handleSubmit = async () => {
    if (!formData.name || !formData.startTime || !formData.endTime) return;

    if (editingId) {
      const restriction = await invoke<Restriction>("update_restriction", {
        id: editingId,
        activityName: formData.name,
        startTime: formData.startTime,
        endTime: formData.endTime,
        studentIds: formData.studentIds,
        day: formData.day,
      }).catch((err) => {
        console.error("Failed to update restriction:", err);
      });
      if (restriction)
        setRestrictions(
          restrictions.map((r) => (r.id === editingId ? restriction : r))
        );
      setEditingId(null);
    } else {
      const restriction = await invoke<Restriction>("add_restriction", {
        activityName: formData.name,
        startTime: formData.startTime,
        endTime: formData.endTime,
        studentIds: formData.studentIds,
        day: formData.day,
      }).catch((err) => {
        console.error("Failed to add restriction:", err);
      });
      if (restriction) setRestrictions([...restrictions, restriction]);
    }

    setFormData({
      name: "",
      startTime: "",
      endTime: "",
      studentIds: [],
      day: "",
    });
    setIsAdding(false);
  };

  const handleEdit = (restriction: Restriction) => {
    setFormData({
      name: restriction.activity_name,
      startTime: restriction.start_time,
      endTime: restriction.end_time,
      studentIds: restriction.student_ids,
      day: restriction.day,
    });
    setEditingId(restriction.id);
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    await invoke("delete_restriction", { id }).catch((err) => {
      console.error("Failed to delete restriction:", err);
    });
    setRestrictions(restrictions.filter((r) => r.id !== id));
  };

  const handleCancel = () => {
    setFormData({
      name: "",
      startTime: "",
      endTime: "",
      studentIds: [],
      day: "",
    });
    setIsAdding(false);
    setEditingId(null);
  };

  const toggleStudent = (studentId: string) => {
    setFormData((prev) => ({
      ...prev,
      studentIds: prev.studentIds.includes(studentId)
        ? prev.studentIds.filter((id) => id !== studentId)
        : [...prev.studentIds, studentId],
    }));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Restrictions</CardTitle>
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
              <Label>Nom de l'activité</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Ex: Sport, Musique..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Heure de début</Label>
                <Input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) =>
                    setFormData({ ...formData, startTime: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Heure de fin</Label>
                <Input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) =>
                    setFormData({ ...formData, endTime: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Jour de la semaine</Label>
              <Select
                value={formData.day}
                onValueChange={(value) =>
                  setFormData({ ...formData, day: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Monday">Lundi</SelectItem>
                  <SelectItem value="Tuesday">Mardi</SelectItem>
                  <SelectItem value="Wednesday">Mercredi</SelectItem>
                  <SelectItem value="Thursday">Jeudi</SelectItem>
                  <SelectItem value="Friday">Vendredi</SelectItem>
                  <SelectItem value="Saturday">Samedi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Élèves concernés</Label>
              <StudentCombobox
                students={students}
                selectedStudentIds={formData.studentIds}
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
          {restrictions.map((restriction) => (
            <div
              key={restriction.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border"
            >
              <div className="flex-1">
                <p className="font-medium">{restriction.activity_name}</p>
                <p className="text-sm text-muted-foreground">
                  {restriction.day} {restriction.start_time} - {restriction.end_time} •{" "}
                  {restriction.student_ids.length} élève(s)
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleEdit(restriction)}
                  variant="ghost"
                  size="sm"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => handleDelete(restriction.id)}
                  variant="ghost"
                  size="sm"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          {restrictions.length === 0 && !isAdding && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucune restriction créée
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
