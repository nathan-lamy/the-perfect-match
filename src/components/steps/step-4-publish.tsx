"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoadingButton } from "@/components/loading-button";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { loadCache, loadSession, sleep } from "@/lib/utils";

interface Assignment {
  student_id: string;
  colle_id: string;
}

interface Colle {
  colle_id: string;
  students_id: string[];
}

interface Step4PublishProps {
  onComplete: () => void;
}

export function Step4Publish({ onComplete }: Step4PublishProps) {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [published, setPublished] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [colles, setColles] = useState<Colle[]>([]);
  const [origin, setOrigin] = useState<string>("");

  useEffect(() => {
    const storedColles = loadCache<Assignment[]>("colles_to_publish");
    const storedOrigin = loadCache<string>("future_slots_url");
    if (storedColles) {
      const convertedColles = Object.values(
        storedColles.reduce(
          (acc, { student_id, colle_id }) => (
            (acc[colle_id] ??= { colle_id, students_id: [] }).students_id.push(
              student_id
            ),
            acc
          ),
          {} as Record<string, Colle>
        )
      );
      console.log("Loaded colles to publish:", convertedColles);
      setColles(convertedColles);
    }
    if (storedOrigin) {
      setOrigin(storedOrigin);
    }
  }, []);

  const handlePublish = function (deleted = false) {
    return async () => {
      if (deleted) {
        setDeleting(true);
      } else {
        setLoading(true);
      }

      const cookie = loadSession();
      for (const colle of colles) {
        const url = await invoke<string>("post_timetable_dashboard", {
          checkboxId: colle.colle_id,
          cookie,
          from: origin,
        });
        await invoke("post_timetable_choice_students", {
          url: "https://bjcolle.fr/" + url,
          cookie,
          studentsId: deleted ? [] : colle.students_id,
        });
        await sleep(250); // To avoid overwhelming the server
      }

      if (deleted) {
        setDeleted(true);
        setDeleting(false);
      } else {
        setPublished(true);
        setLoading(false);
      }
    };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Étape 4 : Publier les colles</CardTitle>
        <CardDescription>
          Publiez l'attribution finale pour la rendre visible sur BJColle
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!published ? (
          <LoadingButton loading={loading} onClick={handlePublish()}>
            Publier {colles.length} colles (
            {colles.reduce((sum, c) => sum + c.students_id.length, 0)} élèves)
          </LoadingButton>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/10 text-primary">
              <CheckCircle2 className="w-6 h-6" />
              <div>
                <p className="font-medium">Publication réussie !</p>
                <p className="text-sm">
                  Les colles ont été publiées avec succès
                </p>
              </div>
            </div>
            <Button onClick={onComplete} variant="outline">
              Retour au début
            </Button>
          </div>
        )}

        {!deleted && (
          <LoadingButton
            loading={deleting}
            onClick={handlePublish(true)}
            variant="destructive"
            className="ml-2"
          >
            Supprimer toutes les colles
          </LoadingButton>
        )}

        {deleted && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 text-destructive">
            <CheckCircle2 className="w-6 h-6" />
            <div>
              <p className="font-medium">Suppression réussie !</p>
              <p className="text-sm">
                Toutes les colles ont été supprimées avec succès
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
