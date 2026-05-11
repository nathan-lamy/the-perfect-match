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

/// Check if a slot should be ignored based on rules.
/// Checks pass-level rules first, then global rules (first match wins).
fn slot_is_ignored(
    slot: &Slot,
    pass_rules: &[SlotRule],
    global_rules: &[SlotRule],
    ignored_slot_ids: &[String],
) -> bool {
    if ignored_slot_ids.contains(&slot.id) {
        return true;
    }

    for rule in pass_rules {
        if matches_rule(slot, rule) {
            return matches!(rule.action, SlotAction::Ignore);
        }
    }

    for rule in global_rules {
        if matches_rule(slot, rule) {
            return matches!(rule.action, SlotAction::Ignore);
        }
    }

    false
}

/// Check if a slot matches a rule's conditions.
fn matches_rule(slot: &Slot, rule: &SlotRule) -> bool {
    if let Some(ref teacher) = rule.match_teacher {
        if &slot.teacher != teacher {
            return false;
        }
    }

    if let Some(ref subject) = rule.match_subject {
        if !slot.subject.contains(subject) {
            return false;
        }
    }

    true
}

/// Get effective capacity for a slot based on rules.
fn effective_capacity(slot: &Slot, pass_rules: &[SlotRule], global_rules: &[SlotRule]) -> usize {
    for rule in pass_rules {
        if matches_rule(slot, rule) {
            if let SlotAction::SetCapacity(cap) = rule.action {
                return cap;
            }
        }
    }

    for rule in global_rules {
        if matches_rule(slot, rule) {
            if let SlotAction::SetCapacity(cap) = rule.action {
                return cap;
            }
        }
    }

    DEFAULT_SLOT_CAPACITY
}

/// Generate time block restrictions from assignments to prevent double-booking.
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
            let student = students.iter().find(|s| s.name == assignment.student)?;

            Some(Restriction {
                id: format!("auto-{}-{}", slot.id, assignment.student),
                activity_name: format!("Assigned: {}", student.name),
                start_time: slot.start_hour.clone(),
                end_time: slot.end_hour.clone(),
                students: vec![assignment.student.clone()],
                day: get_day_of_week(&slot.date),
            })
        })
        .collect()
}

/// Check if a student has a restriction conflict with a slot.
#[inline]
fn has_restriction_conflict(
    student_name: &str,
    slot_day: &str,
    slot_start: i32,
    slot_end: i32,
    restrictions: &[Restriction],
    restriction_margin: i32,
) -> bool {
    for restriction in restrictions {
        if !restriction.students.contains(&student_name.to_string()) {
            continue;
        }

        if restriction.day == slot_day {
            let rest_start = parse_time(&restriction.start_time);
            let rest_end = parse_time(&restriction.end_time);

            if !(slot_end <= rest_start - restriction_margin
                || slot_start >= rest_end + restriction_margin)
            {
                return true;
            }
        }
    }

    false
}

/// Compute score for assigning a student to a slot.
/// Lower is better. Returns `restriction_penalty` (a large positive sentinel)
/// when a hard constraint is violated, so any valid solution scores below it.
fn compute_score(
    student: &Student,
    slot: &Slot,
    slot_day: &str,
    slot_start: i32,
    slot_end: i32,
    restrictions: &[Restriction],
    past_colles: &HashMap<String, HashSet<String>>,
    colles_count: &Vec<CollesCount>,
    previous_assignments: &HashMap<String, String>,
    weights: &Weights,
    noise_factor: u32,
    // FIX: accept RNG from caller instead of re-acquiring thread_rng per cell
    rng: &mut impl Rng,
) -> i32 {
    // Hard constraint: restriction conflict — must be a large POSITIVE value so
    // that `total_score >= restriction_penalty` correctly flags infeasible solutions.
    if has_restriction_conflict(
        &student.name,
        slot_day,
        slot_start,
        slot_end,
        restrictions,
        weights.restriction_margin_minutes,
    ) {
        return weights.restriction_penalty;
    }

    let mut score: i32 = 0;

    if let Some(teachers) = past_colles.get(&student.name) {
        if teachers.contains(&slot.teacher) {
            score = score.saturating_add(weights.last_week_penalty);
        }
    }

    if let Some(prev_date) = previous_assignments.get(&student.name) {
        if prev_date == &slot.date {
            score = score.saturating_add(weights.same_day_penalty);
        }
    }

    // Get colles count for the slot subject (find by slot name)
    let subject_colles_count = colles_count
        .iter()
        .find(|cc| cc.name == slot.subject)
        .map(|cc| &cc.counts);
    // If not found, treat as zero counts (no penalty reduction); if found, get count for this teacher
    if subject_colles_count.is_none() {
        eprintln!(
            "Warning: No colles count found for subject '{}'; treating as zero counts",
            slot.subject
        );
    } else if let Some(student_counts) =
        subject_colles_count.and_then(|counts| counts.get(&student.name))
    {
        if let Some(&count) = student_counts.get(&slot.teacher) {
            score = score.saturating_add(count * weights.total_colles_weight);
        }
    }

    let noise_upper_bound =
        ((weights.total_colles_weight / 10) as f64 * 2_f64.powi(noise_factor as i32)) as i32;
    // FIX: use the passed-in rng instead of re-acquiring thread_rng every call
    let noise = rng.gen_range(0..noise_upper_bound.max(1));
    score.saturating_add(noise)
}

/// Build cost matrix for the Hungarian algorithm.
fn build_cost_matrix(
    students: &[Student],
    slots: &[Slot],
    slot_capacities: &[usize],
    restrictions: &[Restriction],
    past_colles: &HashMap<String, HashSet<String>>,
    colles_count: &Vec<CollesCount>,
    previous_assignments: &HashMap<String, String>,
    weights: &Weights,
    noise_factor: u32,
) -> Vec<Vec<i32>> {
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

    // FIX: initialise RNG once per matrix build, not once per cell
    let mut rng = rand::thread_rng();

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
                        &mut rng,
                    )
                })
                .collect();
            matrix.push(row);
        }
    }

    matrix
}

/// Run the Hungarian algorithm on a cost matrix.
/// Requires rows >= cols (total slot capacity >= number of students).
fn hungarian_algorithm(matrix: &[Vec<i32>]) -> (Vec<Option<usize>>, i32) {
    let rows = matrix.len();
    let cols = if rows > 0 { matrix[0].len() } else { 0 };

    if rows == 0 || cols == 0 {
        return (vec![], 0);
    }

    let flat: Vec<i32> = matrix.iter().flat_map(|row| row.iter().copied()).collect();

    let mat = Matrix::from_vec(rows, cols, flat).expect("Failed to create matrix");
    let (_cost, assignments_vec) = pathfinding::kuhn_munkres::kuhn_munkres_min(&mat);

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

/// Format raw assignments into Assignment structs.
fn format_assignments(
    students: &[Student],
    slots: &[Slot],
    slot_capacities: &[usize],
    raw_assignments: &[Option<usize>],
) -> Vec<Assignment> {
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
                // FIX: use name instead of id
                student: student.name.clone(),
                slot_id: Some(slot.id.clone()),
            })
        })
        .collect()
}

/// Run a single assignment pass.
/// Returns `None` only if the pass is structurally infeasible (hard constraint
/// violated in the best solution found).
fn run_single_pass(
    pass: &AssignmentPass,
    all_students: &[Student],
    all_slots: &[Slot],
    all_restrictions: &[Restriction],
    past_colles: &HashMap<String, HashSet<String>>,
    colles_count: &Vec<CollesCount>,
    previous_assignments: &HashMap<String, String>,
    global_rules: &[SlotRule],
    groups: &[Group],
    weights: &Weights,
    noise_factor: u32,
) -> Option<(Vec<Assignment>, i32)> {
    // FIX: actually filter by group when student_group_id is set
    let students: Vec<Student> = {
        let group_filter: Option<HashSet<&String>> =
            pass.student_group_id.as_ref().and_then(|gid| {
                groups
                    .iter()
                    .find(|g| &g.id == gid)
                    .map(|g| g.students.iter().collect())
            });

        all_students
            .iter()
            .filter(|s| {
                // FIX: renamed ignored_student_ids -> ignored_students, use name
                if pass.ignored_students.contains(&s.name) {
                    return false;
                }
                if let Some(ref allowed) = group_filter {
                    return allowed.contains(&s.name);
                }
                true
            })
            .cloned()
            .collect()
    };

    if students.is_empty() {
        return Some((vec![], 0));
    }

    let slots: Vec<Slot> = all_slots
        .iter()
        .filter(|slot| {
            if !pass.slot_subject_filter.is_empty()
                && !slot.subject.contains(&pass.slot_subject_filter)
            {
                return false;
            }
            !slot_is_ignored(slot, &pass.slot_rules, global_rules, &pass.ignored_slot_ids)
        })
        .cloned()
        .collect();

    if slots.is_empty() {
        return Some((vec![], 0));
    }

    let slot_capacities: Vec<usize> = slots
        .iter()
        .map(|slot| effective_capacity(slot, &pass.slot_rules, global_rules))
        .collect();

    // FIX: guard against panic in kuhn_munkres when students > total capacity
    let total_capacity: usize = slot_capacities.iter().sum();
    if total_capacity < students.len() {
        eprintln!(
            "Pass '{}': total slot capacity ({}) is less than student count ({}); skipping",
            pass.name,
            total_capacity,
            students.len()
        );
        return None;
    }

    let effective_weights = pass.weights.as_ref().unwrap_or(weights);

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

    let (raw_assignments, total_score) = hungarian_algorithm(&matrix);

    // FIX: restriction_penalty must be a large POSITIVE sentinel; any solution
    // that includes even one violated cell will push total_score above it.
    if total_score >= effective_weights.restriction_penalty {
        return None;
    }

    let assignments = format_assignments(&students, &slots, &slot_capacities, &raw_assignments);

    Some((assignments, total_score))
}

/// Run the complete pipeline with all passes.
/// Returns `None` only if every pass in the pipeline fails structurally.
/// Partial results (some passes failed) are propagated so the caller can inspect them.
pub fn run_pipeline(
    students: &[Student],
    slots: &[Slot],
    restrictions: &[Restriction],
    past_colles: &[LastWeekColle],
    colles_count: &Vec<CollesCount>,
    global_rules: &[SlotRule],
    global_weights: &Weights,
    mut passes: Vec<AssignmentPass>,
    groups: &[Group],
    noise_factor: u32,
) -> Option<Vec<PassResult>> {
    passes.sort_by_key(|p| p.priority);

    let past_colles_map: HashMap<String, HashSet<String>> = {
        let mut map: HashMap<String, HashSet<String>> = HashMap::new();
        for colle in past_colles {
            map.entry(colle.student.clone())
                .or_default()
                .insert(colle.teacher.clone());
        }
        map
    };

    let mut all_restrictions = restrictions.to_vec();
    let mut previous_assignments: HashMap<String, String> = HashMap::new();
    let mut results = Vec::new();

    for pass in passes {
        // FIX: don't abort the whole pipeline with `?`; treat a failing pass
        // as returning an empty assignment set and record it.
        let (assignments, total_score) = match run_single_pass(
            &pass,
            students,
            slots,
            &all_restrictions,
            &past_colles_map,
            colles_count,
            &previous_assignments,
            global_rules,
            groups,
            global_weights,
            noise_factor,
        ) {
            Some(result) => result,
            None => {
                eprintln!(
                    "Pass '{}' failed (infeasible); recording empty result.",
                    pass.name
                );
                (vec![], i32::MAX)
            }
        };

        for assignment in &assignments {
            if let Some(slot_id) = &assignment.slot_id {
                if let Some(slot) = slots.iter().find(|s| &s.id == slot_id) {
                    // FIX: key by student name instead of id
                    previous_assignments.insert(assignment.student.clone(), slot.date.clone());
                }
            }
        }

        let time_blocks = generate_time_blocks(students, slots, &assignments);
        all_restrictions.extend(time_blocks);

        // FIX: compute unassigned relative to the pass's own student set,
        // not all students (so ignored students don't appear as unassigned).
        let pass_students: HashSet<&str> = {
            let group_filter: Option<HashSet<&String>> =
                pass.student_group_id.as_ref().and_then(|gid| {
                    groups
                        .iter()
                        .find(|g| &g.id == gid)
                        .map(|g| g.students.iter().collect())
                });

            students
                .iter()
                .filter(|s| {
                    if pass.ignored_students.contains(&s.name) {
                        return false;
                    }
                    if let Some(ref allowed) = group_filter {
                        return allowed.contains(&s.name);
                    }
                    true
                })
                .map(|s| s.name.as_str())
                .collect()
        };

        let assigned_names: HashSet<&str> = assignments
            .iter()
            .filter(|a| a.slot_id.is_some())
            .map(|a| a.student.as_str())
            .collect();

        let unassigned: Vec<String> = pass_students
            .difference(&assigned_names)
            .map(|s| s.to_string())
            .collect();

        results.push(PassResult {
            pass_id: pass.id,
            pass_name: pass.name,
            assignments,
            total_score,
            unassigned_students: unassigned,
        });
    }

    Some(results)
}

/// Compute best pipeline result by running N times in parallel.
/// FIX: removed quota evaluation; returns only Vec<PassResult>.
pub fn compute_best_pipeline(
    students: Vec<Student>,
    slots: Vec<Slot>,
    restrictions: Vec<Restriction>,
    past_colles: Vec<LastWeekColle>,
    colles_count: Vec<CollesCount>,
    global_rules: Vec<SlotRule>,
    global_weights: Weights,
    passes: Vec<AssignmentPass>,
    groups: Vec<Group>,
    n: usize,
) -> Option<Vec<PassResult>> {
    println!("Running pipeline {} times in parallel", n);

    // FIX: pass attempt index as noise_factor so each run is genuinely different
    let results: Vec<(Vec<PassResult>, i64)> = (0..n)
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
                i as u32, // noise_factor varies per attempt
            )?;

            let total_score: i64 = pass_results
                .iter()
                .map(|pr| {
                    if pr.total_score == i32::MAX {
                        // Even if it failed, treat it as the i32 max but in a 64-bit container
                        i32::MAX as i64
                    } else {
                        pr.total_score as i64
                    }
                })
                .sum();

            Some((pass_results, total_score))
        })
        .collect();

    if results.is_empty() {
        return None;
    }

    // Pick the attempt with the lowest total score
    let (best_passes, best_score) = results.into_iter().min_by_key(|(_, score)| *score)?;

    println!("Best result found with score: {}", best_score);

    Some(best_passes)
}
