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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, AlertCircle } from "lucide-react"
import { loadCache, loadSession } from "@/lib/utils"
import type { ColleToPublish } from "@/types"

interface Step5PublishProps {
  onComplete: () => void
}

export function Step5Publish({ onComplete }: Step5PublishProps) {
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [error, setError] = useState<string>("")

  const handlePublish = async () => {
    setPublishing(true)
    setError("")

    try {
      const collesToPublish = loadCache<ColleToPublish[]>("colles_to_publish") || []
      const pageUrl = loadCache<string>("future_slots_url") || ""

      if (collesToPublish.length === 0) {
        setError("Aucune colle à publier")
        setPublishing(false)
        return
      }

      // Step 1: Post to dashboard
      await invoke("post_timetable_dashboard", {
        cookie: loadSession(),
        pageUrl,
      })

      // Step 2: Post student choices
      await invoke("post_timetable_choice_students", {
        cookie: loadSession(),
        pageUrl,
        colles: collesToPublish,
      })

      setPublished(true)
    } catch (err) {
      console.error("Failed to publish:", err)
      setError(
        "Erreur lors de la publication : " +
          (err instanceof Error ? err.message : String(err))
      )
    } finally {
      setPublishing(false)
    }
  }

  const collesToPublish = loadCache<ColleToPublish[]>("colles_to_publish") || []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Publication sur BJColle</CardTitle>
        <CardDescription>
          Publiez les attributions sur la plateforme BJColle
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!published ? (
          <>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {collesToPublish.length} colle(s) prête(s) à être publiée(s)
              </p>
              <p className="text-xs text-muted-foreground">
                Cette action enverra les attributions à BJColle. Assurez-vous que
                les résultats sont corrects avant de continuer.
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <LoadingButton loading={publishing} onClick={handlePublish}>
                Publier sur BJColle
              </LoadingButton>
              <Button variant="outline" onClick={onComplete}>
                Retour au début
              </Button>
            </div>
          </>
        ) : (
          <>
            <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                ✓ Les colles ont été publiées avec succès sur BJColle !
              </AlertDescription>
            </Alert>

            <Button onClick={onComplete} className="w-full">
              Retour au début
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
