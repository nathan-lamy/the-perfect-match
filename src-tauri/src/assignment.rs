// Assignment algorithm module - Generic N-pass pipeline implementation
// This module implements a flexible assignment system that can handle multiple
// passes with different configurations, slot rules, and quotas.

use chrono::{Datelike, NaiveDate, Weekday};
use pathfinding::matrix::Matrix;
use rand::Rng;
use rayon::prelude::*;
use std::collections::{HashMap, HashSet};

use crate::types::*;

// Default slot capacity when no rule matches
const DEFAULT_SLOT_CAPACITY: usize = 3;

/// Parse time string (HH:MM) to minutes since midnight
#[inline]
fn parse_time(time: &str) -> i32 {
    let mut parts = time.split(':');
    let hours: i32 = parts.next().and_then(|h| h.parse().ok()).unwrap_or(0);
    let minutes: i32 = parts.next().and_then(|m| m.parse().ok()).unwrap_or(0);
    hours * 60 + minutes
}

/// Get day of week from date string (YYYY-MM-DD format)
fn get_day_of_week(date_str: &str) -> String {
    if let Ok(date) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
        match date.weekday() {
            Weekday::Mon => "Monday",
            Weekday::Tue => "Tuesday",
            Weekday::Wed => "Wednesday",
            Weekday::Thu => "Thursday",
            Weekday::Fri => "Friday",
            Weekday::Sat => "Saturday",
            Weekday::Sun => "Sunday",
        }
        .to_string()
    } else {
        eprintln!("Failed to parse date: {}", date_str);
        date_str.to_string()
    }
}

/// Check if a slot should be ignored based on rules
/// Checks pass-level rules first, then global rules (first match wins)
fn slot_is_ignored(
    slot: &Slot,
    pass_rules: &[SlotRule],
    global_rules: &[SlotRule],
    ignored_slot_ids: &[String],
) -> bool {
    // Check manual exclusions first
    if ignored_slot_ids.contains(&slot.id) {
        return true;
    }

    // Check pass-level rules first
    for rule in pass_rules {
        if matches_rule(slot, rule) {
            return matches!(rule.action, SlotAction::Ignore);
        }
    }

    // Then check global rules
    for rule in global_rules {
        if matches_rule(slot, rule) {
            return matches!(rule.action, SlotAction::Ignore);
        }
    }

    false
}

/// Check if a slot matches a rule's conditions
fn matches_rule(slot: &Slot, rule: &SlotRule) -> bool {
    // Check teacher match (exact)
    if let Some(ref teacher) = rule.match_teacher {
        if &slot.teacher != teacher {
            return false;
        }
    }

    // Check subject match (substring)
    if let Some(ref subject) = rule.match_subject {
        if !slot.subject.contains(subject) {
            return false;
        }
    }

    true
}

/// Get effective capacity for a slot based on rules
fn effective_capacity(
    slot: &Slot,
    pass_rules: &[SlotRule],
    global_rules: &[SlotRule],
) -> usize {
    // Check pass-level rules first
    for rule in pass_rules {
        if matches_rule(slot, rule) {
            if let SlotAction::SetCapacity(cap) = rule.action {
                return cap;
            }
        }
    }

    // Then check global rules
    for rule in global_rules {
        if matches_rule(slot, rule) {
            if let SlotAction::SetCapacity(cap) = rule.action {
                return cap;
            }
        }
    }

    DEFAULT_SLOT_CAPACITY
}

/// Generate time block restrictions from assignments to prevent double-booking
fn generate_time_blocks(
    students: &[Student],
    slots: &[Slot],
    assignments: &[Assignment],
) -> Vec<Restriction> {
    let slot_map: HashMap<&str, &Slot> = slots.iter().map(|s| (s.id.as_str(), s)).collect();

    assignments
        .iter()
        .filter_map(|assignment| {
            let slot = slot_map.get(assignment.slot_id.as_ref()?.as_str())?;
            let student = students.iter().find(|s| s.id == assignment.student_id)?;

            Some(Restriction {
                id: format!("auto-{}-{}", slot.id, assignment.student_id),
                activity_name: format!("Assigned: {}", student.name),
                start_time: slot.start_hour.clone(),
                end_time: slot.end_hour.clone(),
                student_ids: vec![assignment.student_id.clone()],
                day: get_day_of_week(&slot.date),
            })
        })
        .collect()
}

/// Check if a student has a restriction conflict with a slot
#[inline]
fn has_restriction_conflict(
    student_id: &str,
    slot_day: &str,
    slot_start: i32,
    slot_end: i32,
    restrictions: &[Restriction],
    restriction_margin: i32,
) -> bool {
    for restriction in restrictions {
        if !restriction.student_ids.contains(&student_id.to_string()) {
            continue;
        }

        if restriction.day == slot_day {
            let rest_start = parse_time(&restriction.start_time);
            let rest_end = parse_time(&restriction.end_time);

            // Check for overlap with margin
            if !(slot_end <= rest_start - restriction_margin
                || slot_start >= rest_end + restriction_margin)
            {
                return true;
            }
        }
    }

    false
}

/// Compute score for assigning a student to a slot
fn compute_score(
    student: &Student,
    slot: &Slot,
    slot_day: &str,
    slot_start: i32,
    slot_end: i32,
    restrictions: &[Restriction],
    past_colles: &HashMap<String, HashSet<String>>,
    colles_count: &HashMap<String, HashMap<String, i32>>,
    previous_assignments: &HashMap<String, String>,
    weights: &Weights,
    noise_factor: u32,
) -> i32 {
    let mut score = 0;

    // Hard constraint: restriction conflict
    if has_restriction_conflict(
        &student.id,
        slot_day,
        slot_start,
        slot_end,
        restrictions,
        weights.restriction_margin_minutes,
    ) {
        return weights.restriction_penalty;
    }

    // Last week penalty
    if let Some(teachers) = past_colles.get(&student.name) {
        if teachers.contains(&slot.teacher) {
            score += weights.last_week_penalty;
        }
    }

    // Same day penalty
    if let Some(prev_date) = previous_assignments.get(&student.id) {
        if prev_date == &slot.date {
            score += weights.same_day_penalty;
        }
    }

    // Total colles weight
    if let Some(student_counts) = colles_count.get(&student.name) {
        if let Some(&count) = student_counts.get(&slot.teacher) {
            score += count * weights.total_colles_weight;
        }
    }

    // Add noise for randomization
    let noise_upper_bound =
        ((weights.total_colles_weight / 10) as f64 * 2_f64.powi(noise_factor as i32)) as i32;
    let mut rng = rand::thread_rng();
    let noise = rng.gen_range(0..noise_upper_bound.max(1));
    score += noise;

    score
}

/// Build cost matrix for Hungarian algorithm
fn build_cost_matrix(
    students: &[Student],
    slots: &[Slot],
    slot_capacities: &[usize],
    restrictions: &[Restriction],
    past_colles: &HashMap<String, HashSet<String>>,
    colles_count: &HashMap<String, HashMap<String, i32>>,
    previous_assignments: &HashMap<String, String>,
    weights: &Weights,
    noise_factor: u32,
) -> Vec<Vec<i32>> {
    // Precompute slot info
    let slot_infos: Vec<(String, i32, i32)> = slots
        .iter()
        .map(|slot| {
            (
                get_day_of_week(&slot.date),
                parse_time(&slot.start_hour),
                parse_time(&slot.end_hour),
            )
        })
        .collect();

    // Build matrix: rows = slot positions, cols = students
    let mut matrix = Vec::new();

    for (slot_idx, slot) in slots.iter().enumerate() {
        let capacity = slot_capacities[slot_idx];
        let (day, start, end) = &slot_infos[slot_idx];

        for _ in 0..capacity {
            let row: Vec<i32> = students
                .iter()
                .map(|student| {
                    compute_score(
                        student,
                        slot,
                        day,
                        *start,
                        *end,
                        restrictions,
                        past_colles,
                        colles_count,
                        previous_assignments,
                        weights,
                        noise_factor,
                    )
                })
                .collect();
            matrix.push(row);
        }
    }

    matrix
}

/// Run Hungarian algorithm on cost matrix
fn hungarian_algorithm(matrix: &[Vec<i32>]) -> (Vec<Option<usize>>, i32) {
    let rows = matrix.len();
    let cols = if rows > 0 { matrix[0].len() } else { 0 };

    if rows == 0 || cols == 0 {
        return (vec![], 0);
    }

    // Flatten matrix for pathfinding crate
    let flat: Vec<i32> = matrix.iter().flat_map(|row| row.iter().copied()).collect();

    let mat = Matrix::from_vec(rows, cols, flat).expect("Failed to create matrix");
    let (_cost, assignments_vec) = pathfinding::kuhn_munkres::kuhn_munkres_min(&mat);

    // Convert to our format and calculate total weight
    let mut assignments = vec![None; rows];
    let mut total_weight = 0;

    for (row_idx, &col_idx) in assignments_vec.iter().enumerate() {
        if row_idx < rows && col_idx < cols {
            assignments[row_idx] = Some(col_idx);
            total_weight += matrix[row_idx][col_idx];
        }
    }

    (assignments, total_weight)
}

/// Format raw assignments into Assignment structs
fn format_assignments(
    students: &[Student],
    slots: &[Slot],
    slot_capacities: &[usize],
    raw_assignments: &[Option<usize>],
) -> Vec<Assignment> {
    // Build row-to-slot mapping
    let mut row_to_slot = Vec::new();
    for (slot_idx, &capacity) in slot_capacities.iter().enumerate() {
        for _ in 0..capacity {
            row_to_slot.push(slot_idx);
        }
    }

    raw_assignments
        .iter()
        .enumerate()
        .filter_map(|(row_idx, student_idx)| {
            let student_idx = (*student_idx)?;
            let slot_idx = *row_to_slot.get(row_idx)?;
            let student = students.get(student_idx)?;
            let slot = slots.get(slot_idx)?;

            Some(Assignment {
                student_id: student.id.clone(),
                slot_id: Some(slot.id.clone()),
            })
        })
        .collect()
}

/// Run a single assignment pass
fn run_single_pass(
    pass: &AssignmentPass,
    all_students: &[Student],
    all_slots: &[Slot],
    all_restrictions: &[Restriction],
    past_colles: &HashMap<String, HashSet<String>>,
    colles_count: &HashMap<String, HashMap<String, i32>>,
    previous_assignments: &HashMap<String, String>,
    global_rules: &[SlotRule],
    weights: &Weights,
    noise_factor: u32,
) -> Option<(Vec<Assignment>, i32)> {
    // Filter students for this pass
    let students: Vec<Student> = if let Some(ref _group_id) = pass.student_group_id {
        // TODO: Filter by group_id once group membership is implemented
        all_students
            .iter()
            .filter(|s| !pass.ignored_student_ids.contains(&s.id))
            .cloned()
            .collect()
    } else {
        all_students
            .iter()
            .filter(|s| !pass.ignored_student_ids.contains(&s.id))
            .cloned()
            .collect()
    };

    if students.is_empty() {
        return Some((vec![], 0));
    }

    // Filter slots for this pass
    let slots: Vec<Slot> = all_slots
        .iter()
        .filter(|slot| {
            // Subject filter
            if !pass.slot_subject_filter.is_empty()
                && !slot.subject.contains(&pass.slot_subject_filter)
            {
                return false;
            }

            // Check if ignored
            !slot_is_ignored(slot, &pass.slot_rules, global_rules, &pass.ignored_slot_ids)
        })
        .cloned()
        .collect();

    if slots.is_empty() {
        return Some((vec![], 0));
    }

    // Calculate capacities
    let slot_capacities: Vec<usize> = slots
        .iter()
        .map(|slot| effective_capacity(slot, &pass.slot_rules, global_rules))
        .collect();

    // Use pass weights or fall back to global
    let effective_weights = pass.weights.as_ref().unwrap_or(weights);

    // Build cost matrix
    let matrix = build_cost_matrix(
        &students,
        &slots,
        &slot_capacities,
        all_restrictions,
        past_colles,
        colles_count,
        previous_assignments,
        effective_weights,
        noise_factor,
    );

    // Run Hungarian algorithm
    let (raw_assignments, total_score) = hungarian_algorithm(&matrix);

    // Check if solution is valid (no hard constraint violations)
    if total_score >= effective_weights.restriction_penalty {
        return None;
    }

    // Format assignments
    let assignments = format_assignments(&students, &slots, &slot_capacities, &raw_assignments);

    Some((assignments, total_score))
}

/// Run the complete pipeline with all passes
pub fn run_pipeline(
    students: &[Student],
    slots: &[Slot],
    restrictions: &[Restriction],
    past_colles: &[PastColle],
    colles_count: &CollesCount,
    global_rules: &[SlotRule],
    global_weights: &Weights,
    mut passes: Vec<AssignmentPass>,
    _groups: &[Group],
) -> Option<Vec<PassResult>> {
    // Sort passes by priority
    passes.sort_by_key(|p| p.priority);

    // Build lookup structures
    let past_colles_map: HashMap<String, HashSet<String>> = past_colles
        .iter()
        .map(|pc| (pc.name.clone(), pc.teachers.iter().cloned().collect()))
        .collect();

    let colles_count_map: HashMap<String, HashMap<String, i32>> = colles_count
        .data
        .iter()
        .map(|sc| {
            let counts: HashMap<String, i32> = colles_count
                .header
                .iter()
                .enumerate()
                .filter_map(|(i, teacher)| {
                    sc.counts.get(i).map(|&count| (teacher.clone(), count))
                })
                .collect();
            (sc.student.clone(), counts)
        })
        .collect();

    let mut all_restrictions = restrictions.to_vec();
    let mut previous_assignments: HashMap<String, String> = HashMap::new();
    let mut results = Vec::new();

    // Execute each pass sequentially
    for pass in passes {
        let (assignments, total_score) = run_single_pass(
            &pass,
            students,
            slots,
            &all_restrictions,
            &past_colles_map,
            &colles_count_map,
            &previous_assignments,
            global_rules,
            global_weights,
            0, // noise_factor starts at 0
        )?;

        // Update previous assignments for same-day penalty
        for assignment in &assignments {
            if let Some(slot_id) = &assignment.slot_id {
                if let Some(slot) = slots.iter().find(|s| &s.id == slot_id) {
                    previous_assignments.insert(assignment.student_id.clone(), slot.date.clone());
                }
            }
        }

        // Generate time blocks to prevent double-booking in next passes
        let time_blocks = generate_time_blocks(students, slots, &assignments);
        all_restrictions.extend(time_blocks);

        // Find unassigned students
        let assigned_ids: HashSet<&String> = assignments
            .iter()
            .filter(|a| a.slot_id.is_some())
            .map(|a| &a.student_id)
            .collect();

        let unassigned: Vec<String> = students
            .iter()
            .filter(|s| !assigned_ids.contains(&s.id))
            .map(|s| s.id.clone())
            .collect();

        results.push(PassResult {
            pass_id: pass.id,
            pass_name: pass.name,
            assignments,
            total_score,
            unassigned_student_ids: unassigned,
        });
    }

    Some(results)
}

/// Evaluate quotas after all passes complete
pub fn evaluate_quotas(
    passes: &[PassResult],
    slots: &[Slot],
    quotas: &[SubjectQuota],
    groups: &[Group],
) -> (Vec<QuotaViolation>, Vec<StudentQuotaProgress>) {
    let mut violations = Vec::new();
    let mut progress = Vec::new();

    // Build slot lookup
    let slot_map: HashMap<&str, &Slot> = slots.iter().map(|s| (s.id.as_str(), s)).collect();

    // Count assignments per student per quota
    for quota in quotas {
        // Determine which students this quota applies to
        let applicable_students: HashSet<String> = if let Some(ref group_id) = quota.group_id {
            groups
                .iter()
                .find(|g| &g.id == group_id)
                .map(|g| g.student_ids.iter().cloned().collect())
                .unwrap_or_default()
        } else {
            // All students
            passes
                .iter()
                .flat_map(|p| p.assignments.iter().map(|a| a.student_id.clone()))
                .collect()
        };

        // Count for each student
        let mut student_counts: HashMap<String, u32> = HashMap::new();

        for pass_result in passes {
            for assignment in &pass_result.assignments {
                if !applicable_students.contains(&assignment.student_id) {
                    continue;
                }

                if let Some(slot_id) = &assignment.slot_id {
                    if let Some(slot) = slot_map.get(slot_id.as_str()) {
                        // Check if slot matches quota filter
                        if quota.subject_filter.is_empty()
                            || slot.subject.contains(&quota.subject_filter)
                        {
                            *student_counts.entry(assignment.student_id.clone()).or_insert(0) += 1;
                        }
                    }
                }
            }
        }

        // Generate progress and violations
        for student_id in applicable_students {
            let count = student_counts.get(&student_id).copied().unwrap_or(0);

            progress.push(StudentQuotaProgress {
                student_id: student_id.clone(),
                quota_id: quota.id.clone(),
                quota_name: quota.name.clone(),
                subject_filter: quota.subject_filter.clone(),
                assigned_count: count,
                max_colles: quota.max_colles,
            });

            if count > quota.max_colles {
                violations.push(QuotaViolation {
                    quota_id: quota.id.clone(),
                    quota_name: quota.name.clone(),
                    student_id,
                    subject_filter: quota.subject_filter.clone(),
                    assigned_count: count,
                    max_colles: quota.max_colles,
                });
            }
        }
    }

    (violations, progress)
}

/// Compute best pipeline result by running N times in parallel
pub fn compute_best_pipeline(
    students: Vec<Student>,
    slots: Vec<Slot>,
    restrictions: Vec<Restriction>,
    past_colles: Vec<PastColle>,
    colles_count: CollesCount,
    global_rules: Vec<SlotRule>,
    global_weights: Weights,
    passes: Vec<AssignmentPass>,
    groups: Vec<Group>,
    quotas: Vec<SubjectQuota>,
    n: usize,
) -> Option<ComputeResult> {
    println!("Running pipeline {} times in parallel", n);

    // Run N times in parallel using Rayon
    let results: Vec<(Vec<PassResult>, i32)> = (0..n)
        .into_par_iter()
        .filter_map(|i| {
            println!("Attempt {}/{}", i + 1, n);

            let pass_results = run_pipeline(
                &students,
                &slots,
                &restrictions,
                &past_colles,
                &colles_count,
                &global_rules,
                &global_weights,
                passes.clone(),
                &groups,
            )?;

            let total_score: i32 = pass_results.iter().map(|pr| pr.total_score).sum();

            Some((pass_results, total_score))
        })
        .collect();

    if results.is_empty() {
        return None;
    }

    // Find best result (lowest score)
    let (best_passes, best_score) = results
        .into_iter()
        .min_by_key(|(_, score)| *score)?;

    println!("Best result found with score: {}", best_score);

    // Evaluate quotas
    let (quota_violations, quota_progress) =
        evaluate_quotas(&best_passes, &slots, &quotas, &groups);

    Some(ComputeResult {
        passes: best_passes,
        quota_violations,
        quota_progress,
    })
}
