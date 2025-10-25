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

export interface Colle {
  studentId: string;
  colleId: string;
}

interface Step4PublishProps {
  onComplete: () => void;
}

export function Step4Publish({ onComplete }: Step4PublishProps) {
  const [loading, setLoading] = useState(false);
  const [published, setPublished] = useState(false);
  const [colles, setColles] = useState<Colle[]>([]);
  const [origin, setOrigin] = useState<string>("");

  useEffect(() => {
    const storedColles = loadCache<Colle[]>("colles_to_publish");
    const storedOrigin = loadCache<string>("future_slots_url");
    if (storedColles) {
      console.log("Loaded colles to publish:", storedColles);
      setColles(storedColles);
    }
    if (storedOrigin) {
      setOrigin(storedOrigin);
    }
  }, []);

  const handlePublish = async () => {
    setLoading(true);

    const cookie = loadSession();
    for (const colle of colles) {
      const url = await invoke<string>("post_timetable_dashboard", {
        checkboxId: colle.colleId,
        cookie,
        from: origin,
      });
      console.log("Dashboard URL:", url);
      await invoke("post_timetable_choice_students", {
        url: "https://bjcolle.fr/" + url,
        cookie,
        studentId: colle.studentId,
      });
      await sleep(500); // To avoid overwhelming the server
    }

    setPublished(true);
    setLoading(false);
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
          <LoadingButton loading={loading} onClick={handlePublish}>
            Publier {colles.length} colles
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
      </CardContent>
    </Card>
  );
}
