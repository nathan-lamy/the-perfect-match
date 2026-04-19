export interface Student {
  id: string
  first_name: string
  last_name: string
  name: string
}

export interface StudentsData {
  colles_counts: CollesCount
  students: Student[]
}

export interface CollesCount {
  header: string[]
  data: StudentWithCounts[]
}

interface StudentWithCounts {
  student: string // student name
  counts: number[] // counts per teacher
}

export interface Restriction {
  id: string
  activity_name: string
  start_time: string
  end_time: string
  day: string // Format: Monday, Tuesday, etc.
  student_ids: string[]
}

export interface Group {
  id: string
  name: string
  student_ids: string[]
}

export interface PastColle {
  name: string
  teachers: string[]
}

export interface Slot {
  id: string
  teacher: string
  date: string // Format: YYYY-MM-DD
  start_hour: string // Format: HH:MM
  end_hour: string // Format: HH:MM
  subject: string
  is_assigned: boolean
}

// Legacy alias for backward compatibility
export type FutureSlot = Slot

export interface Assignment {
  student_id: string
  slot_id: string | null
}

// ============= Slot Rules & Actions =============

export type SlotAction =
  | { type: 'SetCapacity'; value: number }
  | { type: 'Ignore' }

export interface SlotRule {
  id: string
  name: string
  match_teacher: string | null
  match_subject: string | null
  action: SlotAction
}

// ============= Weights =============

export interface Weights {
  last_week_penalty: number
  same_day_penalty: number
  total_colles_weight: number
  restriction_penalty: number
  restriction_margin_minutes: number
}

export const DEFAULT_WEIGHTS: Weights = {
  last_week_penalty: 6_000_000,
  same_day_penalty: 3_000,
  total_colles_weight: 50,
  restriction_penalty: 12_000_000,
  restriction_margin_minutes: 31,
}

// ============= Subject Quotas =============

export interface SubjectQuota {
  id: string
  name: string
  subject_filter: string
  max_colles: number
  group_id: string | null
}

export interface QuotaViolation {
  quota_id: string
  quota_name: string
  student_id: string
  subject_filter: string
  assigned_count: number
  max_colles: number
}

export interface StudentQuotaProgress {
  student_id: string
  quota_id: string
  quota_name: string
  subject_filter: string
  assigned_count: number
  max_colles: number
}

// ============= Assignment Pass =============

export interface AssignmentPass {
  id: string
  name: string
  slot_subject_filter: string
  student_group_id: string | null
  weights: Weights | null
  slot_rules: SlotRule[]
  ignored_slot_ids: string[]
  ignored_student_ids: string[]
  priority: number
}

// ============= Assignment Results =============

export interface PassResult {
  pass_id: string
  pass_name: string
  assignments: Assignment[]
  total_score: number
  unassigned_student_ids: string[]
}

export interface ComputeResult {
  passes: PassResult[]
  quota_violations: QuotaViolation[]
  quota_progress: StudentQuotaProgress[]
}

// ============= Publishing =============

export interface ColleToPublish {
  student_id: string
  colle_id: string | null
}
