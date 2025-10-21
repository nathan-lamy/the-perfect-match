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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "lucide-react";
import type { FutureSlot } from "@/types";
import { invoke } from "@tauri-apps/api/core";
import { loadSession, saveCache } from "@/lib/utils";

interface Step2FutureCollesProps {
  onNext: () => void;
  onSkip: () => void;
}

export function Step2FutureColles({ onNext, onSkip }: Step2FutureCollesProps) {
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [futureSlots, setFutureSlots] = useState<FutureSlot[]>([]);

  const handleLoad = async () => {
    setLoading(true);
    const { colles: slots, url } = await invoke<{ colles: FutureSlot[]; url: string }>(
      "fetch_future_colles",
      {
        date: startDate,
        cookie: loadSession(),
      }
    ).catch((err) => {
      console.error("Failed to fetch future slots:", err);
      return { colles: [], url: "" };
    });

    setFutureSlots(slots);
    if (slots.length) {
      setLoaded(true);
      saveCache("future_slots", slots);
      saveCache("future_slots_url", url);
      saveCache("future_slots_date", startDate);
    }
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Récupérer les créneaux de colles à venir</CardTitle>
        <CardDescription>
          Chargez les créneaux disponibles pour l'attribution
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="week-start-date" className="text-sm font-medium">
            Premier jour de la semaine de colles à venir
          </Label>
          <div className="relative max-w-xs">
            <Input
              id="week-start-date"
              type="text"
              placeholder="JJ/MM"
              className="pr-10"
              disabled={loaded}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
          <p className="text-xs text-muted-foreground">
            Sélectionnez le lundi de la semaine de colle à venir
          </p>
        </div>

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
