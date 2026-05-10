use std::collections::HashMap;

use serde::{Deserialize, Serialize};

// ============= Core Data Types =============

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Student {
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
    pub is_assigned: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Restriction {
    pub id: String,
    pub activity_name: String,
    pub start_time: String,
    pub end_time: String,
    pub students: Vec<String>,
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
    pub students: Vec<String>,
}

// ============= Colles Count Types =============

pub type HistoricalCount = HashMap<String, HashMap<String, i32>>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollesCount {
    pub name: String,
    pub id: i32,
    pub counts: HistoricalCount,
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
    pub ignored_students: Vec<String>, // Manually excluded students
    pub priority: u32,                  // Execution order (0 = first)
}

// ============= Assignment Results =============

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Assignment {
    pub student: String,
    pub slot_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PassResult {
    pub pass_id: String,
    pub pass_name: String,
    pub assignments: Vec<Assignment>,
    pub total_score: i32,
    pub unassigned_students: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComputeResult {
    pub passes: Vec<PassResult>,
}
