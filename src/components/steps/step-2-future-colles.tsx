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
import type { FutureSlot } from "@/types";

interface Step2FutureCollesProps {
  futureSlots: FutureSlot[];
  setFutureSlots: (slots: FutureSlot[]) => void;
  onNext: () => void;
  onSkip: () => void;
}

export function Step2FutureColles({
  futureSlots,
  setFutureSlots,
  onNext,
  onSkip,
}: Step2FutureCollesProps) {
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const handleLoad = async () => {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Mock data
    const mockSlots: FutureSlot[] = [
      {
        id: "1",
        subject: "Mathématiques",
        date: "2025-01-15",
        time: "09:00",
        available: true,
      },
      {
        id: "2",
        subject: "Mathématiques",
        date: "2025-01-15",
        time: "10:00",
        available: true,
      },
      {
        id: "3",
        subject: "Physique",
        date: "2025-01-16",
        time: "09:00",
        available: true,
      },
      {
        id: "4",
        subject: "Physique",
        date: "2025-01-16",
        time: "10:00",
        available: true,
      },
      {
        id: "5",
        subject: "Chimie",
        date: "2025-01-17",
        time: "09:00",
        available: true,
      },
    ];

    setFutureSlots(mockSlots);
    setLoaded(true);
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Étape 2 : Récupérer les créneaux de colles à venir
        </CardTitle>
        <CardDescription>
          Chargez les créneaux disponibles pour l'attribution
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!loaded ? (
          <div className="flex gap-2">
            <LoadingButton loading={loading} onClick={handleLoad}>
              Charger les créneaux
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
              {futureSlots.length} créneau(x) disponible(s)
            </p>
            <Button onClick={onNext}>Continuer</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
