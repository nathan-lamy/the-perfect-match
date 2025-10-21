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
import type { Student, Restriction, StudentGroup, StudentsData } from "@/types";
import { StudentList } from "@/components/student-list";
import { RestrictionManager } from "@/components/restriction-manager";
import { GroupManager } from "@/components/group-manager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { invoke } from "@tauri-apps/api/core";
import { loadSession } from "@/lib/utils";

interface Step0StudentsProps {
  onNext: () => void;
}

export function Step0Students({ onNext }: Step0StudentsProps) {
  const [loading, setLoading] = useState(false);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [restrictions, setRestrictions] = useState<Restriction[]>([]);
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([]);

  const handleLoadStudents = async () => {
    setLoading(true);

    const { students } = await invoke<StudentsData>("get_students", {
      cookie: loadSession() || "",
      disc: 1,  // Discipline 1 is for Maths
    });
    const restrictions = await invoke<Restriction[]>("load_restrictions");
    const groups = await invoke<StudentGroup[]>("load_groups");

    setRestrictions(restrictions);
    setStudentGroups(groups);
    setStudents(
      students.map((s) => ({ ...s, name: s.first_name + " " + s.last_name }))
    );

    if (students.length) {
      setStudentsLoaded(true);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Récupérer les élèves</CardTitle>
          <CardDescription>
            Chargez la liste des élèves, les groupes et les restrictions
          </CardDescription>
        </CardHeader>
        <CardContent className="">
          {!studentsLoaded ? (
            <div>
              <LoadingButton loading={loading} onClick={handleLoadStudents}>
                Charger les élèves
              </LoadingButton>
              <Button
                variant="ghost"
                onClick={onNext}
                className="text-muted-foreground"
              >
                Passer cette étape
              </Button>
            </div>
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
