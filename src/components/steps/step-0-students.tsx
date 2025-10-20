"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoadingButton } from "@/components/loading-button";
import { Button } from "@/components/ui/button";
import type { Student, Restriction, StudentGroup } from "@/types";
import { StudentList } from "@/components/student-list";
import { RestrictionManager } from "@/components/restriction-manager";
import { GroupManager } from "@/components/group-manager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Step0StudentsProps {
  students: Student[];
  setStudents: (students: Student[]) => void;
  restrictions: Restriction[];
  setRestrictions: (restrictions: Restriction[]) => void;
  studentGroups: StudentGroup[];
  setStudentGroups: (groups: StudentGroup[]) => void;
  onNext: () => void;
}

export function Step0Students({
  students,
  setStudents,
  restrictions,
  setRestrictions,
  studentGroups,
  setStudentGroups,
  onNext,
}: Step0StudentsProps) {
  const [loading, setLoading] = useState(false);
  const [studentsLoaded, setStudentsLoaded] = useState(false);

  const handleLoadStudents = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Mock data
    const mockStudents: Student[] = [
      { id: "1", name: "Alice Dupont", email: "alice@example.com" },
      { id: "2", name: "Bob Martin", email: "bob@example.com" },
      { id: "3", name: "Claire Bernard", email: "claire@example.com" },
      { id: "4", name: "David Petit", email: "david@example.com" },
      { id: "5", name: "Emma Dubois", email: "emma@example.com" },
    ];

    setStudents(mockStudents);
    setStudentsLoaded(true);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Étape 0 : Récupérer les élèves</CardTitle>
          <CardDescription>
            Chargez la liste des élèves depuis le système
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!studentsLoaded ? (
            <LoadingButton loading={loading} onClick={handleLoadStudents}>
              Charger les élèves
            </LoadingButton>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {students.length} élève(s) chargé(s)
                </p>
                <Button onClick={onNext}>Continuer</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {studentsLoaded && (
        <Tabs defaultValue="students" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="students">Élèves</TabsTrigger>
            <TabsTrigger value="restrictions">Restrictions</TabsTrigger>
            <TabsTrigger value="groups">Groupes</TabsTrigger>
          </TabsList>

          <TabsContent value="students" className="mt-6">
            <StudentList students={students} />
          </TabsContent>

          <TabsContent value="restrictions" className="mt-6">
            <RestrictionManager
              restrictions={restrictions}
              setRestrictions={setRestrictions}
              students={students}
            />
          </TabsContent>

          <TabsContent value="groups" className="mt-6">
            <GroupManager
              groups={studentGroups}
              setGroups={setStudentGroups}
              students={students}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
