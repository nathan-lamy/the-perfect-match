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
import { CheckCircle2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { loadSession } from "@/lib/utils";

interface Step4PublishProps {
  onComplete: () => void;
}

export function Step4Publish({ onComplete }: Step4PublishProps) {
  const [loading, setLoading] = useState(false);
  const [published, setPublished] = useState(false);

  const handlePublish = async () => {
    setLoading(true);

    // TODO: Remove test
    const url = await invoke<string>("post_timetable_dashboard", {
      checkboxId: "COCHER_E1",
      cookie: loadSession(),
      from: "https://bjcolle.fr/timetable_dashboard_period.php?page=2"
    });
    console.log("Dashboard URL:", url);
    await invoke("post_timetable_choice_students", {
      url: "https://bjcolle.fr/" + url,
      cookie: loadSession(),
      studentId: "E30"  // TODO: Remove test
    })

    await new Promise((resolve) => setTimeout(resolve, 2000));
    setPublished(true);
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Étape 4 : Publier les colles</CardTitle>
        <CardDescription>
          Publiez l'attribution finale pour la rendre visible aux élèves
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!published ? (
          <LoadingButton loading={loading} onClick={handlePublish}>
            Publier les colles
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
