"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { DEFAULT_WEIGHTS, type Weights } from "@/types"

interface WeightsEditorProps {
  weights: Weights
  onChange: (weights: Weights) => void
}

export function WeightsEditor({ weights, onChange }: WeightsEditorProps) {
  const handleReset = () => {
    onChange(DEFAULT_WEIGHTS)
  }

  const handleChange = (field: keyof Weights, value: string) => {
    const numValue = parseInt(value, 10)
    if (!isNaN(numValue)) {
      onChange({ ...weights, [field]: numValue })
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="last_week_penalty">
            Pénalité colle semaine dernière
          </Label>
          <Input
            id="last_week_penalty"
            type="number"
            value={weights.last_week_penalty}
            onChange={(e) => handleChange("last_week_penalty", e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Pénalité appliquée si l'élève a eu le même professeur la semaine dernière
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="same_day_penalty">
            Pénalité même jour
          </Label>
          <Input
            id="same_day_penalty"
            type="number"
            value={weights.same_day_penalty}
            onChange={(e) => handleChange("same_day_penalty", e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Pénalité si l'élève a déjà une colle le même jour
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="total_colles_weight">
            Poids nombre total de colles
          </Label>
          <Input
            id="total_colles_weight"
            type="number"
            value={weights.total_colles_weight}
            onChange={(e) => handleChange("total_colles_weight", e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Poids multiplié par le nombre de colles déjà faites avec ce professeur
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="restriction_penalty">
            Pénalité restriction
          </Label>
          <Input
            id="restriction_penalty"
            type="number"
            value={weights.restriction_penalty}
            onChange={(e) => handleChange("restriction_penalty", e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Pénalité si le créneau chevauche une restriction (contrainte dure)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="restriction_margin_minutes">
            Marge restriction (minutes)
          </Label>
          <Input
            id="restriction_margin_minutes"
            type="number"
            value={weights.restriction_margin_minutes}
            onChange={(e) => handleChange("restriction_margin_minutes", e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Marge de temps (en minutes) autour des restrictions
          </p>
        </div>
      </div>

      <Button variant="outline" onClick={handleReset} className="w-full">
        Réinitialiser aux valeurs par défaut
      </Button>
    </div>
  )
}
