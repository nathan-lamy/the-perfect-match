"use client"

import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LoadingButton } from "@/components/loading-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "lucide-react"
import type { Slot } from "@/types"
import { loadSession, saveCache } from "@/lib/utils"

interface Step2FetchSlotsProps {
  onNext: () => void
  onSkip: () => void
}

export function Step2FetchSlots({ onNext, onSkip }: Step2FetchSlotsProps) {
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [allSlots, setAllSlots] = useState<Slot[]>([])
  const [selectedSlotIds, setSelectedSlotIds] = useState<Set<string>>(new Set())
  const [pageUrl, setPageUrl] = useState("")

  const handleLoad = async () => {
    setLoading(true)
    try {
      const response = await invoke<{ colles: Slot[]; url: string }>(
        "fetch_future_colles",
        {
          startDate,
          endDate,
          cookie: loadSession(),
        }
      )

      setAllSlots(response.colles)
      setPageUrl(response.url)
      // Select all by default
      setSelectedSlotIds(new Set(response.colles.map((s) => s.id)))
      setLoaded(true)
    } catch (err) {
      console.error("Failed to fetch future slots:", err)
      alert("Erreur lors du chargement des créneaux: " + err)
    } finally {
      setLoading(false)
    }
  }

  const handleContinue = () => {
    const activeSlots = allSlots.filter((s) => selectedSlotIds.has(s.id))
    saveCache("future_slots", activeSlots)
    saveCache("future_slots_url", pageUrl)
    onNext()
  }

  const toggleSlot = (slotId: string) => {
    const newSet = new Set(selectedSlotIds)
    if (newSet.has(slotId)) {
      newSet.delete(slotId)
    } else {
      newSet.add(slotId)
    }
    setSelectedSlotIds(newSet)
  }

  const toggleSubject = (subject: string, checked: boolean) => {
    const newSet = new Set(selectedSlotIds)
    allSlots
      .filter((s) => s.subject === subject)
      .forEach((s) => {
        if (checked) {
          newSet.add(s.id)
        } else {
          newSet.delete(s.id)
        }
      })
    setSelectedSlotIds(newSet)
  }

  const includeAll = () => {
    setSelectedSlotIds(new Set(allSlots.map((s) => s.id)))
  }

  const excludeAll = () => {
    setSelectedSlotIds(new Set())
  }

  // Group slots by subject
  const slotsBySubject = allSlots.reduce((acc, slot) => {
    if (!acc[slot.subject]) {
      acc[slot.subject] = []
    }
    acc[slot.subject].push(slot)
    return acc
  }, {} as Record<string, Slot[]>)

  const subjects = Object.keys(slotsBySubject).sort()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Récupérer les créneaux de colles à venir</CardTitle>
        <CardDescription>
          Sélectionnez une plage de dates et choisissez les créneaux à inclure
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!loaded ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date" className="text-sm font-medium">
                  Date de début
                </Label>
                <div className="relative">
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={loading}
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="end-date" className="text-sm font-medium">
                  Date de fin
                </Label>
                <div className="relative">
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    disabled={loading}
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Les créneaux seront récupérés pour tous les lundis dans cette plage
            </p>

            <div className="flex gap-2">
              {!startDate || !endDate ? (
                <Button disabled>Charger les créneaux</Button>
              ) : (
                <LoadingButton loading={loading} onClick={handleLoad}>
                  Charger les créneaux
                </LoadingButton>
              )}
              <Button
                variant="ghost"
                onClick={onSkip}
                className="text-muted-foreground"
              >
                Passer cette étape
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {selectedSlotIds.size} / {allSlots.length} créneau(x) sélectionné(s)
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={includeAll}>
                  Tout inclure
                </Button>
                <Button variant="outline" size="sm" onClick={excludeAll}>
                  Tout exclure
                </Button>
              </div>
            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto border rounded-lg p-4">
              {subjects.map((subject) => {
                const subjectSlots = slotsBySubject[subject]
                const selectedCount = subjectSlots.filter((s) =>
                  selectedSlotIds.has(s.id)
                ).length
                const allSelected = selectedCount === subjectSlots.length
                const someSelected = selectedCount > 0 && !allSelected

                return (
                  <div key={subject} className="space-y-2">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(checked) =>
                          toggleSubject(subject, checked === true)
                        }
                        className={someSelected ? "opacity-50" : ""}
                      />
                      <div className="flex-1 font-medium">{subject}</div>
                      <Badge variant="secondary">
                        {selectedCount} / {subjectSlots.length}
                      </Badge>
                    </div>

                    <div className="pl-6 space-y-1">
                      {subjectSlots.map((slot) => (
                        <div
                          key={slot.id}
                          className="flex items-center gap-2 py-1 hover:bg-muted/50 rounded px-2"
                        >
                          <Checkbox
                            checked={selectedSlotIds.has(slot.id)}
                            onCheckedChange={() => toggleSlot(slot.id)}
                          />
                          <div className="flex-1 text-sm">
                            <span className="font-medium">{slot.teacher}</span>
                            {" — "}
                            <span className="text-muted-foreground">
                              {slot.date} {slot.start_hour}-{slot.end_hour}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <Button onClick={handleContinue} className="w-full">
              Continuer
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
