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

  const handleLoad = async () => {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Mock data
    const mockColles: PastColle[] = [
      { id: "1", studentId: "1", subject: "Mathématiques", date: "2025-01-05" },
      { id: "2", studentId: "2", subject: "Physique", date: "2025-01-06" },
      { id: "3", studentId: "3", subject: "Mathématiques", date: "2025-01-07" },
    ];

    setPastColles(mockColles);
    setLoaded(true);
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Étape 1 : Récupérer les colles passées</CardTitle>
        <CardDescription>
          Chargez l'historique des colles pour optimiser l'attribution
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
