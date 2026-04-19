"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import type {
  StudentQuotaProgress,
  QuotaViolation,
  Student,
  SubjectQuota,
  Group,
} from "@/types"

interface QuotaTrackerProps {
  progress: StudentQuotaProgress[]
  violations: QuotaViolation[]
  students: Student[]
  quotas: SubjectQuota[]
  groups: Group[]
}

export function QuotaTracker({
  progress,
  violations,
  students,
  quotas,
  groups,
}: QuotaTrackerProps) {
  const [viewMode, setViewMode] = useState<"by-quota" | "by-student">("by-quota")

  const getStudentName = (studentId: string) => {
    const student = students.find((s) => s.id === studentId)
    return student ? student.name : studentId
  }

  const getQuotaName = (quotaId: string) => {
    const quota = quotas.find((q) => q.id === quotaId)
    return quota ? quota.name : quotaId
  }

  const getGroupName = (groupId: string | null) => {
    if (!groupId) return null
    const group = groups.find((g) => g.id === groupId)
    return group ? group.name : null
  }

  const renderByQuotaView = () => {
    // Group progress by quota
    const progressByQuota = progress.reduce((acc, p) => {
      if (!acc[p.quota_id]) {
        acc[p.quota_id] = []
      }
      acc[p.quota_id].push(p)
      return acc
    }, {} as Record<string, StudentQuotaProgress[]>)

    return (
      <div className="space-y-6">
        {quotas.map((quota) => {
          const quotaProgress = progressByQuota[quota.id] || []
          const groupName = getGroupName(quota.group_id)

          return (
            <Card key={quota.id}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  {quota.name}
                  {groupName && (
                    <Badge variant="secondary">{groupName}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {quotaProgress.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Aucun élève concerné
                    </p>
                  ) : (
                    quotaProgress.map((p) => {
                      const isViolated = violations.some(
                        (v) => v.student_id === p.student_id && v.quota_id === p.quota_id
                      )
                      const isComplete = p.assigned_count === p.max_colles
                      const remaining = p.max_colles - p.assigned_count

                      const progressPercent = Math.min(
                        (p.assigned_count / p.max_colles) * 100,
                        100
                      )

                      return (
                        <div
                          key={p.student_id}
                          className="flex items-center gap-4 p-2 rounded border"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {getStudentName(p.student_id)}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="w-full bg-secondary rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  isViolated
                                    ? "bg-amber-500"
                                    : isComplete
                                    ? "bg-green-500"
                                    : "bg-primary"
                                }`}
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                          </div>
                          <div className="text-sm font-medium w-16 text-right">
                            {p.assigned_count} / {p.max_colles}
                          </div>
                          <div className="w-32">
                            {isViolated ? (
                              <Badge variant="destructive">⚠ Dépassé</Badge>
                            ) : isComplete ? (
                              <Badge className="bg-green-600">✓ Complet</Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">
                                {remaining} restante{remaining > 1 ? "s" : ""}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  const renderByStudentView = () => {
    // Group progress by student
    const progressByStudent = progress.reduce((acc, p) => {
      if (!acc[p.student_id]) {
        acc[p.student_id] = []
      }
      acc[p.student_id].push(p)
      return acc
    }, {} as Record<string, StudentQuotaProgress[]>)

    // Get all unique students from progress
    const studentIds = Object.keys(progressByStudent)

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b">
              <th className="sticky left-0 bg-background p-2 text-left font-medium border-r">
                Élève
              </th>
              {quotas.map((quota) => (
                <th key={quota.id} className="p-2 text-center font-medium min-w-[120px]">
                  <div className="text-sm">{quota.name}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {studentIds.map((studentId) => {
              const studentProgress = progressByStudent[studentId]

              return (
                <tr key={studentId} className="border-b hover:bg-muted/50">
                  <td className="sticky left-0 bg-background p-2 font-medium border-r">
                    {getStudentName(studentId)}
                  </td>
                  {quotas.map((quota) => {
                    const p = studentProgress.find((sp) => sp.quota_id === quota.id)

                    if (!p) {
                      return (
                        <td key={quota.id} className="p-2 text-center text-muted-foreground">
                          —
                        </td>
                      )
                    }

                    const isViolated = violations.some(
                      (v) => v.student_id === studentId && v.quota_id === quota.id
                    )
                    const progressPercent = Math.min(
                      (p.assigned_count / p.max_colles) * 100,
                      100
                    )

                    return (
                      <td key={quota.id} className="p-2">
                        <div className="flex flex-col items-center gap-1">
                          <div className="text-xs font-medium">
                            {p.assigned_count}/{p.max_colles}
                          </div>
                          <div className="w-full bg-secondary rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${
                                isViolated
                                  ? "bg-amber-500"
                                  : p.assigned_count === p.max_colles
                                  ? "bg-green-500"
                                  : "bg-primary"
                              }`}
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Violation banner */}
      {violations.length > 0 ? (
        <Alert variant="destructive" className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium mb-2">
              {violations.length} dépassement{violations.length > 1 ? "s" : ""} de quota détecté{violations.length > 1 ? "s" : ""}
            </div>
            <div className="space-y-1 text-sm">
              {violations.map((v, i) => (
                <div key={i}>
                  {getStudentName(v.student_id)} — {v.quota_name} : {v.assigned_count} / {v.max_colles}
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            Tous les quotas sont respectés ✓
          </AlertDescription>
        </Alert>
      )}

      {/* View mode toggle */}
      <div className="flex gap-2">
        <Button
          variant={viewMode === "by-quota" ? "default" : "outline"}
          onClick={() => setViewMode("by-quota")}
        >
          Par quota
        </Button>
        <Button
          variant={viewMode === "by-student" ? "default" : "outline"}
          onClick={() => setViewMode("by-student")}
        >
          Par élève
        </Button>
      </div>

      {/* Content */}
      {viewMode === "by-quota" ? renderByQuotaView() : renderByStudentView()}
    </div>
  )
}
