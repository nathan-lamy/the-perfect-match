export interface Student {
  first_name: string;
  last_name: string;
  name: string;
}

export type historicalCounts = {
  id: number;
  name: string;
  counts: Record<string, Record<string, number>>;
};

export interface Slot {
  id: string;
  teacher: string;
  date: string;
  start_hour: string;
  end_hour: string;
  subject: string;
  is_assigned: boolean;
}

export interface Restriction {
  id: string;
  activity_name: string;
  day: string;
  start_time: string;
  end_time: string;
  students: string[];
}

export interface Group {
  id: string;
  name: string;
  students: string[];
}

export type SlotAction =
  | { type: "SetCapacity"; value: number }
  | { type: "Ignore" };

export interface SlotRule {
  id: string;
  name: string;
  match_teacher?: string;
  match_subject?: string;
  action: SlotAction;
}

export interface Weights {
  last_week_penalty: number;
  same_day_penalty: number;
  total_colles_weight: number;
  restriction_penalty: number;
  restriction_margin_minutes: number;
}

export interface AssignmentPass {
  id: string;
  name: string;
  priority: number;
  slot_subject_filter: string;
  student_group_id: string | null;
  weights: Weights | null;
  slot_rules: SlotRule[];
  ignored_slot_ids: string[];
  ignored_students: string[];
}

// export interface SubjectQuota {
//   id: string;
//   name: string;
//   subject_filter: string;
//   max_colles: number;
//   group_id: string | null;
// }

export interface ComputeResult {
  passes: {
    pass_id: string;
    pass_name: string;
    assignments: { student: string; slot_id: string }[];
    total_score: number;
    unassigned_students: string[];
  }[];
  // quota_violations: {
  //   quota_id: string;
  //   quota_name: string;
  //   student_id: string;
  //   assigned_count: number;
  //   max_colles: number;
  // }[];
  // quota_progress: {
  //   student_id: string;
  //   quota_id: string;
  //   quota_name: string;
  //   subject_filter: string;
  //   assigned_count: number;
  //   max_colles: number;
  // }[];
  computation_ms: number;
  iterations: number;
}

export const DEFAULT_WEIGHTS: Weights = {
  last_week_penalty: 6_000, 
  same_day_penalty: 3,
  total_colles_weight: 1, // Scaled down to maintain ratio
  restriction_penalty: 12_000,
  restriction_margin_minutes: 31,
};

export interface ColleProgressEvent {
  slot_id: string;
  done: string[];
  total: number;
  error: string | null;
}