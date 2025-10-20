import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Restriction, Student } from "@/types";
import { Plus, Trash2, Edit2, X, Check } from "lucide-react";
import { StudentCombobox } from "@/components/student-combobox";

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
    startTime: "",
    endTime: "",
    studentIds: [] as string[],
  });

  const handleSubmit = () => {
    if (!formData.name || !formData.startTime || !formData.endTime) return;

    if (editingId) {
      setRestrictions(
        restrictions.map((r) =>
          r.id === editingId ? { ...formData, id: editingId } : r
        )
      );
      setEditingId(null);
    } else {
      const newRestriction: Restriction = {
        ...formData,
        id: Date.now().toString(),
      };
      setRestrictions([...restrictions, newRestriction]);
    }

    setFormData({ name: "", startTime: "", endTime: "", studentIds: [] });
    setIsAdding(false);
  };

  const handleEdit = (restriction: Restriction) => {
    setFormData(restriction);
    setEditingId(restriction.id);
    setIsAdding(true);
  };

  const handleDelete = (id: string) => {
    setRestrictions(restrictions.filter((r) => r.id !== id));
  };

  const handleCancel = () => {
    setFormData({ name: "", startTime: "", endTime: "", studentIds: [] });
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
                <p className="font-medium">{restriction.name}</p>
                <p className="text-sm text-muted-foreground">
                  {restriction.startTime} - {restriction.endTime} •{" "}
                  {restriction.studentIds.length} élève(s)
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
