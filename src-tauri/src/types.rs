use serde::{Deserialize, Serialize};

// ============= Core Data Types =============

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Student {
    pub id: String,
    pub name: String,
    pub first_name: String,
    pub last_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Slot {
    pub id: String,
    pub date: String,       // Format: YYYY-MM-DD
    pub start_hour: String, // Format: HH:MM
    pub end_hour: String,   // Format: HH:MM
    pub teacher: String,
    pub subject: String,
    pub is_assigned: bool, // TODO: Parse from HTML
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Restriction {
    pub id: String,
    pub activity_name: String,
    pub start_time: String,
    pub end_time: String,
    pub student_ids: Vec<String>,
    pub day: String, // Format: Monday, Tuesday, etc.
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PastColle {
    pub name: String,
    pub teachers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Group {
    pub id: String,
    pub name: String,
    pub student_ids: Vec<String>,
}

// ============= Colles Count Types =============

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudentCounts {
    pub student: String,
    pub counts: Vec<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollesCount {
    pub header: Vec<String>,
    pub data: Vec<StudentCounts>,
}

// ============= Slot Rules & Actions =============

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "value")]
pub enum SlotAction {
    SetCapacity(usize),
    Ignore,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlotRule {
    pub id: String,
    pub name: String,
    pub match_teacher: Option<String>,  // Exact match; None = match any
    pub match_subject: Option<String>,  // Substring match; None = match any
    pub action: SlotAction,
}

// ============= Weights =============

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Weights {
    pub last_week_penalty: i32,
    pub same_day_penalty: i32,
    pub total_colles_weight: i32,
    pub restriction_penalty: i32,
    pub restriction_margin_minutes: i32,
}

pub const DEFAULT_WEIGHTS: Weights = Weights {
    last_week_penalty: 6_000_000,
    same_day_penalty: 3_000,
    total_colles_weight: 50,
    restriction_penalty: 12_000_000,
    restriction_margin_minutes: 31,
};

// ============= Subject Quotas =============

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubjectQuota {
    pub id: String,
    pub name: String,
    pub subject_filter: String, // Substring match on slot.subject
    pub max_colles: u32,
    pub group_id: Option<String>, // None = all students
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuotaViolation {
    pub quota_id: String,
    pub quota_name: String,
    pub student_id: String,
    pub subject_filter: String,
    pub assigned_count: u32,
    pub max_colles: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudentQuotaProgress {
    pub student_id: String,
    pub quota_id: String,
    pub quota_name: String,
    pub subject_filter: String,
    pub assigned_count: u32,
    pub max_colles: u32,
}

// ============= Assignment Pass =============

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssignmentPass {
    pub id: String,
    pub name: String,
    pub slot_subject_filter: String,    // Substring match on slot.subject
    pub student_group_id: Option<String>, // None = all students
    pub weights: Option<Weights>,       // None = use global weights
    pub slot_rules: Vec<SlotRule>,      // Pass-level rules
    pub ignored_slot_ids: Vec<String>,  // Manually excluded slots
    pub ignored_student_ids: Vec<String>, // Manually excluded students
    pub priority: u32,                  // Execution order (0 = first)
}

// ============= Assignment Results =============

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Assignment {
    pub student_id: String,
    pub slot_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PassResult {
    pub pass_id: String,
    pub pass_name: String,
    pub assignments: Vec<Assignment>,
    pub total_score: i32,
    pub unassigned_student_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComputeResult {
    pub passes: Vec<PassResult>,
    pub quota_violations: Vec<QuotaViolation>,
    pub quota_progress: Vec<StudentQuotaProgress>,
}
