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
import type { PastColle } from "@/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { loadSession, saveCache } from "@/lib/utils";

interface Step1PastCollesProps {
  pastColles: PastColle[];
  setPastColles: (colles: PastColle[]) => void;
  onNext: () => void;
  onSkip: () => void;
}

export function Step1PastColles({
  pastColles,
  setPastColles,
  onNext,
  onSkip,
}: Step1PastCollesProps) {
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [startDate, setStartDate] = useState("");

  const handleLoad = async () => {
    setLoading(true);
    const colles = await invoke<PastColle[]>("fetch_last_week_colles", {
      date: startDate,
      cookie: loadSession()
    }).catch((err) => {
      console.error("Failed to fetch past colles:", err);
      return [];
    });

    setPastColles(colles);
    if (colles.length) {
      saveCache("last_week", colles);
      setLoaded(true);
    }
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Récupérer les colles passées</CardTitle>
        <CardDescription>
          Chargez l'historique des colles pour optimiser l'attribution
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="week-start-date" className="text-sm font-medium">
            Premier jour de la semaine précédente
          </Label>
          <div className="relative max-w-xs">
            <Input
              id="week-start-date"
              type="text"
              placeholder="YYYY/MM/JJ"
              className="pr-10"
              disabled={loaded}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
          <p className="text-xs text-muted-foreground">
            Sélectionnez le lundi de la dernière semaine de colle
          </p>
        </div>

        {!loaded ? (
          <div className="flex gap-2">
            <LoadingButton loading={loading} onClick={handleLoad}>
              Charger les colles passées
            </LoadingButton>
            <Button
              variant="ghost"
              onClick={onSkip}
              className="text-muted-foreground"
            >
              Passer cette étape
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {pastColles.length} colle(s) passée(s) chargée(s)
            </p>
            <Button onClick={onNext}>Continuer</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
