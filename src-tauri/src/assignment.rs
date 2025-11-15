use chrono::{Datelike, NaiveDate, Weekday};
use pathfinding::matrix::Matrix;
use rand::Rng;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

// Constants - could be moved to a config file
const RESTRICTION_PENALTY: i32 = 12_000_000;
const LAST_WEEK_PENALTY_BASE: i32 = 6_000_000;
const SAME_DAY_PENALTY: i32 = 3_000;
const TOTAL_COLLES_WEIGHT: i32 = 50;
const MAX_SCORE: i32 = RESTRICTION_PENALTY;
const MAX_RETRIES: usize = 10;
const TIME_MARGIN: i32 = 31;
const PLACES_BY_SLOT: usize = 3;

// Type definitions with Serde support for serialization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Student {
    pub id: String,
    pub name: String,
    pub first_name: String,
    pub last_name: String,
}

impl Student {
    #[inline]
    fn full_name(&self) -> String {
        format!("{} {}", self.last_name, self.first_name)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FutureSlot {
    pub id: String,
    pub date: String,
    pub start_hour: String,
    pub end_hour: String,
    pub teacher: String,
    pub subject: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Restriction {
    pub id: String,
    pub activity_name: String,
    pub start_time: String,
    pub end_time: String,
    pub student_ids: Vec<String>,
    pub day: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PastColle {
    pub name: String,
    pub teachers: Vec<String>,
}

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Assignment {
    pub student_id: String,
    pub slot_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssignmentResult {
    pub assignments: Vec<Assignment>,
    pub total_score: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComputeResult {
    pub math: AssignmentResult,
    pub physics: AssignmentResult,
}

// Utility functions using chrono for proper date handling
#[inline]
fn parse_time(time: &str) -> i32 {
    let mut parts = time.split(':');
    let hours: i32 = parts.next().and_then(|h| h.parse().ok()).unwrap_or(0);
    let minutes: i32 = parts.next().and_then(|m| m.parse().ok()).unwrap_or(0);
    hours * 60 + minutes
}

fn get_day_of_week(date_str: &str) -> String {
    // Parse date in ISO format (YYYY-MM-DD)
    if let Ok(date) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
        let weekday = date.weekday();
        match weekday {
            Weekday::Mon => "Lundi",
            Weekday::Tue => "Mardi",
            Weekday::Wed => "Mercredi",
            Weekday::Thu => "Jeudi",
            Weekday::Fri => "Vendredi",
            Weekday::Sat => "Samedi",
            Weekday::Sun => "Dimanche",
        }
        .to_string()
    } else {
        // Fallback: return the date string itself
        eprintln!("Failed to parse date: {}", date_str);
        date_str.to_string()
    }
}

// Optimized cache structures
struct RestrictionCache {
    by_student: HashMap<String, Vec<usize>>,
}

impl RestrictionCache {
    fn new(restrictions: &[Restriction]) -> Self {
        let mut by_student: HashMap<String, Vec<usize>> = HashMap::new();

        for (idx, restriction) in restrictions.iter().enumerate() {
            for student_id in &restriction.student_ids {
                by_student
                    .entry(student_id.clone())
                    .or_insert_with(Vec::new)
                    .push(idx);
            }
        }

        println!("Built restriction cache with {} students", by_student.len());
        Self { by_student }
    }

    #[inline]
    fn get_restrictions_for_student(&self, student_id: &str) -> Option<&[usize]> {
        self.by_student.get(student_id).map(|v| v.as_slice())
    }
}

struct PastColleCache {
    by_name: HashMap<String, HashSet<String>>,
}

impl PastColleCache {
    fn new(past_colles: &[PastColle]) -> Self {
        let mut by_name: HashMap<String, HashSet<String>> = HashMap::new();

        for past_colle in past_colles {
            by_name.insert(
                past_colle.name.clone(),
                past_colle.teachers.iter().cloned().collect(),
            );
        }

        println!("Built past colle cache with {} students", by_name.len());
        Self { by_name }
    }

    #[inline]
    fn has_teacher(&self, name: &str, teacher: &str) -> bool {
        self.by_name
            .get(name)
            .map_or(false, |teachers| teachers.contains(teacher))
    }
}

struct CollesCountCache {
    teacher_index: HashMap<String, usize>,
    student_counts: HashMap<String, Vec<i32>>,
}

impl CollesCountCache {
    fn new(colles_count: &CollesCount) -> Self {
        let teacher_index: HashMap<String, usize> = colles_count
            .header
            .iter()
            .enumerate()
            .map(|(i, t)| (t.clone(), i))
            .collect();

        let student_counts: HashMap<String, Vec<i32>> = colles_count
            .data
            .iter()
            .map(|sc| (sc.student.clone(), sc.counts.clone()))
            .collect();

        println!(
            "Built colles count cache with {} teachers and {} students",
            teacher_index.len(),
            student_counts.len()
        );
        Self {
            teacher_index,
            student_counts,
        }
    }

    #[inline]
    fn get_count(&self, student_name: &str, teacher: &str) -> Option<i32> {
        let teacher_idx = self.teacher_index.get(teacher)?;
        let counts = self.student_counts.get(student_name)?;
        counts.get(*teacher_idx).copied()
    }
}

// Assignment with student and slot information
struct AssignmentWithSlot {
    student_id: String,
    slot: Option<FutureSlot>,
}

// Precomputed slot information
struct SlotInfo {
    day: String,
    start_time: i32,
    end_time: i32,
    places: usize,
}

// Optimized restriction conflict check
#[inline]
fn has_restriction_conflict(
    student_id: &str,
    // TODO: Check if not needed to pass full slot
    _slot: &FutureSlot,
    slot_day: &str,
    slot_start: i32,
    slot_end: i32,
    restrictions: &[Restriction],
    restriction_cache: &RestrictionCache,
) -> bool {
    if let Some(restriction_indices) = restriction_cache.get_restrictions_for_student(student_id) {
        for &idx in restriction_indices {
            let restriction = &restrictions[idx];
            if restriction.day == slot_day {
                let rest_start = parse_time(&restriction.start_time);
                let rest_end = parse_time(&restriction.end_time);

                if !(slot_end <= rest_start - TIME_MARGIN || slot_start >= rest_end + TIME_MARGIN) {
                    return true;
                }
            }
        }
    }
    false
}

// Optimized score computation
fn compute_score(
    student: &Student,
    slot: &FutureSlot,
    slot_info: &SlotInfo,
    restrictions: &[Restriction],
    restriction_cache: &RestrictionCache,
    past_colle_cache: &PastColleCache,
    colles_count_cache: &CollesCountCache,
    previous_assignments: &HashMap<String, String>,
    noise_factor: u32,
) -> i32 {
    let mut score = 0;

    // Restriction penalty - early return for hard constraint
    if has_restriction_conflict(
        &student.id,
        slot,
        &slot_info.day,
        slot_info.start_time,
        slot_info.end_time,
        restrictions,
        restriction_cache,
    ) {
        return RESTRICTION_PENALTY;
    }

    // Last week penalty
    if past_colle_cache.has_teacher(&student.full_name(), &slot.teacher) {
        score += LAST_WEEK_PENALTY_BASE;
    }

    // Same day penalty
    if let Some(prev_date) = previous_assignments.get(&student.id) {
        if prev_date == &slot.date {
            score += SAME_DAY_PENALTY;
        }
    }

    // Total colles penalty
    if let Some(count) = colles_count_cache.get_count(&student.name, &slot.teacher) {
        score += count * TOTAL_COLLES_WEIGHT;

        // HOT FIX: Extra weight for M. MOULIN
        if slot.teacher == "M. MOULIN" {
            score += count * TOTAL_COLLES_WEIGHT * 10;
        }
    }

    // Noise for randomization
    let noise_upper_bound =
        ((TOTAL_COLLES_WEIGHT / 10) as f64 * 2_f64.powi(noise_factor as i32)) as i32;
    let mut rng = rand::thread_rng();
    let noise = rng.gen_range(0..noise_upper_bound.max(1));
    score += noise;

    score
}

// Optimized matrix creation
fn make_matrix(
    students: &[Student],
    slots: &[FutureSlot],
    restrictions: &[Restriction],
    past_colles: &[PastColle],
    total_colles: &CollesCount,
    previous_assignments: &[AssignmentWithSlot],
    noise_factor: u32,
) -> Vec<Vec<i32>> {
    println!(
        "Creating cost matrix: {} students × {} slot positions",
        students.len(),
        slots
            .iter()
            .map(|s| if s.teacher == "M. MOULIN" {
                1
            } else {
                PLACES_BY_SLOT
            })
            .sum::<usize>()
    );

    // Build caches
    let restriction_cache = RestrictionCache::new(restrictions);
    let past_colle_cache = PastColleCache::new(past_colles);
    let colles_count_cache = CollesCountCache::new(total_colles);

    // Build previous assignments map for O(1) lookup
    let prev_assignments_map: HashMap<String, String> = previous_assignments
        .iter()
        .filter_map(|a| {
            a.slot
                .as_ref()
                .map(|s| (a.student_id.clone(), s.date.clone()))
        })
        .collect();

    // Precompute slot information
    let slot_infos: Vec<SlotInfo> = slots
        .iter()
        .map(|slot| SlotInfo {
            day: get_day_of_week(&slot.date),
            start_time: parse_time(&slot.start_hour),
            end_time: parse_time(&slot.end_hour),
            places: if slot.teacher == "M. MOULIN" {
                1
            } else {
                PLACES_BY_SLOT
            },
        })
        .collect();

    // Create matrix
    let mut matrix = Vec::new();

    for (slot, slot_info) in slots.iter().zip(slot_infos.iter()) {
        for _ in 0..slot_info.places {
            let row: Vec<i32> = students
                .iter()
                .map(|student| {
                    compute_score(
                        student,
                        slot,
                        slot_info,
                        restrictions,
                        &restriction_cache,
                        &past_colle_cache,
                        &colles_count_cache,
                        &prev_assignments_map,
                        noise_factor,
                    )
                })
                .collect();
            matrix.push(row);
        }
    }

    println!(
        "Matrix created with dimensions {}×{}",
        matrix.len(),
        matrix.first().map_or(0, |r| r.len())
    );
    matrix
}

// Format raw assignments into Assignment structs
fn format_assignments(
    students: &[Student],
    slots: &[FutureSlot],
    raw_assignments: &[Option<usize>],
) -> Vec<Assignment> {
    raw_assignments
        .iter()
        .enumerate()
        .map(|(slot_index, student_index)| match student_index {
            None => Assignment {
                student_id: String::new(),
                slot_id: None,
            },
            Some(idx) => {
                let student = &students[*idx];
                let slot = &slots[slot_index / PLACES_BY_SLOT];
                Assignment {
                    student_id: student.id.clone(),
                    slot_id: Some(slot.id.clone()),
                }
            }
        })
        .collect()
}

// Generate restrictions from assignments
fn generate_restrictions_from_assignments(
    students: &[Student],
    slots: &[FutureSlot],
    assignments: &[Assignment],
) -> Vec<Restriction> {
    // Build lookup maps for O(1) access
    let slot_map: HashMap<&str, &FutureSlot> = slots.iter().map(|s| (s.id.as_str(), s)).collect();

    let student_map: HashMap<&str, &Student> =
        students.iter().map(|s| (s.id.as_str(), s)).collect();

    let restrictions: Vec<Restriction> = assignments
        .iter()
        .filter_map(|assignment| {
            let slot = slot_map.get(assignment.slot_id.as_ref()?.as_str())?;
            let student = student_map.get(assignment.student_id.as_str());
            let student_name = student.map(|s| s.name.as_str()).unwrap_or("Unknown");

            Some(Restriction {
                id: format!("auto-restriction-{}-{}", slot.id, assignment.student_id),
                activity_name: format!("Assigned Slot for {}", student_name),
                start_time: slot.start_hour.clone(),
                end_time: slot.end_hour.clone(),
                student_ids: vec![assignment.student_id.clone()],
                day: get_day_of_week(&slot.date),
            })
        })
        .collect();

    println!(
        "Generated {} auto-restrictions from assignments",
        restrictions.len()
    );
    restrictions
}

// Hungarian algorithm using pathfinding crate
fn min_weight_assign(matrix: &[Vec<i32>]) -> (Vec<Option<usize>>, i32) {
    let rows = matrix.len();
    let cols = if rows > 0 { matrix[0].len() } else { 0 };

    if rows == 0 || cols == 0 {
        eprintln!("Empty matrix provided to munkres algorithm");
        return (vec![], 0);
    }

    println!("Running Hungarian algorithm on {}×{} matrix", rows, cols);

    // Convert to f64 for munkres crate (it expects f64)
    let weights = matrix;

    // Flatten the weights WITHOUT consuming it
    let rows = weights.len();
    let cols = weights[0].len();

    let flat = weights.iter().flat_map(|row| row.iter().copied()).collect();

    // Build the matrix for Kuhn-Munkres
    let mat = Matrix::from_vec(rows, cols, flat).unwrap_or_else(|e| {
        panic!("Failed to create matrix for munkres: {}", e);
    });
    let (cost, assignments_vec) = pathfinding::kuhn_munkres::kuhn_munkres(&mat);

    // Convert back to our format
    let mut assignments = vec![None; rows];
    let mut total_weight = 0;

    for (row_idx, &col_idx) in assignments_vec.iter().enumerate() {
        if row_idx < rows && col_idx < cols {
            assignments[row_idx] = Some(col_idx);
            total_weight += matrix[row_idx][col_idx];
        }
    }

    println!(
        "Hungarian algorithm completed with total cost: {} (munkres cost: {})",
        total_weight, cost as i32
    );

    (assignments, total_weight)
}

// Get assignments with retries
fn get_assignments<F1, F2>(
    students: &[Student],
    math_colles: &[FutureSlot],
    make_matrix1: F1,
    make_matrix2: F2,
) -> Option<(Vec<Option<usize>>, i32, Vec<Option<usize>>, i32)>
where
    F1: Fn(u32) -> Vec<Vec<i32>>,
    F2: Fn(u32, &[Restriction], &[Assignment]) -> Vec<Vec<i32>>,
{
    for noise_factor in 0..MAX_RETRIES as u32 {
        println!(
            "Attempt {}/{} with noise factor {}",
            noise_factor + 1,
            MAX_RETRIES,
            noise_factor
        );

        let matrix1 = make_matrix1(noise_factor);
        let (a1, weight1) = min_weight_assign(&matrix1);

        println!(
            "Math assignment: weight = {}, threshold = {}",
            weight1, MAX_SCORE
        );

        if weight1 < MAX_SCORE {
            let fa1 = format_assignments(students, math_colles, &a1);
            let fa1_filtered: Vec<Assignment> =
                fa1.into_iter().filter(|a| a.slot_id.is_some()).collect();

            println!(
                "First assignment successful with {} valid assignments",
                fa1_filtered.len()
            );

            let new_restrictions =
                generate_restrictions_from_assignments(students, math_colles, &fa1_filtered);

            let matrix2 = make_matrix2(noise_factor, &new_restrictions, &fa1_filtered);
            let (a2, weight2) = min_weight_assign(&matrix2);

            println!(
                "Physics assignment: weight = {}, threshold = {}",
                weight2, MAX_SCORE
            );

            if weight2 < MAX_SCORE {
                println!("Both assignments successful!");
                return Some((a1, weight1, a2, weight2));
            } else {
                eprintln!("Physics assignment failed with weight {}", weight2);
            }
        } else {
            eprintln!("Math assignment failed with weight {}", weight1);
        }

        println!("Retrying with increased noise factor");
    }

    eprintln!(
        "Failed to find valid assignment after {} attempts",
        MAX_RETRIES
    );
    None
}

// Main computation function
pub fn compute_assignments(
    students: &[Student],
    slots: &[FutureSlot],
    restrictions: &[Restriction],
    past_colles: &[PastColle],
    math_count: &CollesCount,
    phys_group: &[String],
    phys_count: &CollesCount,
) -> Option<ComputeResult> {
    println!("Starting assignment computation");
    println!("Total students: {}", students.len());
    println!("Total slots: {}", slots.len());
    println!("Total restrictions: {}", restrictions.len());

    // Filter math and physics colles
    let math_colles: Vec<FutureSlot> = slots
        .iter()
        .filter(|s| s.subject.contains("Mathématiques"))
        .cloned()
        .collect();

    let phys_colles: Vec<FutureSlot> = slots
        .iter()
        .filter(|s| s.subject.contains("Physique-Chimie"))
        .cloned()
        .collect();

    println!(
        "Math colles: {} slots ({} positions)",
        math_colles.len(),
        math_colles.len() * PLACES_BY_SLOT
    );
    println!(
        "Physics colles: {} slots ({} positions)",
        phys_colles.len(),
        phys_colles.len() * PLACES_BY_SLOT
    );
    println!("Physics group: {} students", phys_group.len());

    // Create matrix generators
    let make_math_matrix = |noise_factor: u32| {
        make_matrix(
            students,
            &math_colles,
            restrictions,
            past_colles,
            math_count,
            &[],
            noise_factor,
        )
    };

    let phys_students: Vec<Student> = students
        .iter()
        .filter(|s| phys_group.contains(&s.id))
        .cloned()
        .collect();

    let make_phys_matrix = |noise_factor: u32,
                            new_restrictions: &[Restriction],
                            previous_assignments: &[Assignment]| {
        let slot_map: HashMap<&str, &FutureSlot> =
            slots.iter().map(|s| (s.id.as_str(), s)).collect();

        let math_assignments: Vec<AssignmentWithSlot> = previous_assignments
            .iter()
            .map(|pa| AssignmentWithSlot {
                student_id: pa.student_id.clone(),
                slot: pa
                    .slot_id
                    .as_ref()
                    .and_then(|id| slot_map.get(id.as_str()))
                    .map(|&s| s.clone()),
            })
            .collect();

        let mut all_restrictions = restrictions.to_vec();
        all_restrictions.extend_from_slice(new_restrictions);

        make_matrix(
            &phys_students,
            &phys_colles,
            &all_restrictions,
            past_colles,
            phys_count,
            &math_assignments,
            noise_factor,
        )
    };

    // Get assignments
    let (math_raw, math_score, phys_raw, phys_score) =
        get_assignments(students, &math_colles, make_math_matrix, make_phys_matrix)?;

    let math_assignments = format_assignments(students, &math_colles, &math_raw);
    let phys_assignments = format_assignments(&phys_students, &phys_colles, &phys_raw);

    let missing_math: Vec<&Student> = students
        .iter()
        .filter(|s| {
            !math_assignments
                .iter()
                .any(|a| a.student_id == s.id && a.slot_id.is_some())
        })
        .collect();

    let missing_phys: Vec<&Student> = phys_students
        .iter()
        .filter(|s| {
            !phys_assignments
                .iter()
                .any(|a| a.student_id == s.id && a.slot_id.is_some())
        })
        .collect();

    if !missing_math.is_empty() {
        eprintln!(
            "Missing math assignments for {} students",
            missing_math.len()
        );
    }
    if !missing_phys.is_empty() {
        eprintln!(
            "Missing physics assignments for {} students",
            missing_phys.len()
        );
    }

    println!("Assignment computation completed successfully");

    Some(ComputeResult {
        math: AssignmentResult {
            assignments: math_assignments
                .into_iter()
                .filter(|a| a.slot_id.is_some())
                .collect(),
            total_score: math_score,
        },
        physics: AssignmentResult {
            assignments: phys_assignments
                .into_iter()
                .filter(|a| a.slot_id.is_some())
                .collect(),
            total_score: phys_score,
        },
    })
}

// Parallel computation of multiple assignments using rayon
// This is the main entry point called from Tauri
pub fn compute_best_assignment(
    students: Vec<Student>,
    slots: Vec<FutureSlot>,
    restrictions: Vec<Restriction>,
    past_colles: Vec<PastColle>,
    math_count: CollesCount,
    phys_group: Vec<String>,
    phys_count: CollesCount,
    n: usize,
) -> Option<ComputeResult> {
    println!(
        "Generating {} assignments in parallel to find the best one",
        n
    );

    // Use rayon for parallel computation
    let results: Vec<(ComputeResult, i32)> = (0..n)
        .into_par_iter()
        .filter_map(|i| {
            let thread_id = rayon::current_thread_index().unwrap_or(0);
            println!("Thread {}: Starting attempt {}/{}", thread_id, i + 1, n);

            let result = compute_assignments(
                &students,
                &slots,
                &restrictions,
                &past_colles,
                &math_count,
                &phys_group,
                &phys_count,
            )?;

            let total_score = result.math.total_score + result.physics.total_score;
            println!(
                "Thread {}: Assignment {} completed with total score: {}",
                thread_id,
                i + 1,
                total_score
            );

            Some((result, total_score))
        })
        .collect();

    if results.is_empty() {
        eprintln!("Failed to generate any valid assignment");
        return None;
    }

    // Find the best result
    let (best_result, best_score) = results.into_iter().min_by_key(|(_, score)| *score)?;

    println!("=== Best Assignment Selected ===");
    println!("Math score: {}", best_result.math.total_score);
    println!("Physics score: {}", best_result.physics.total_score);
    println!("Total score: {}", best_score);
    println!("Math assignments: {}", best_result.math.assignments.len());
    println!(
        "Physics assignments: {}",
        best_result.physics.assignments.len()
    );

    Some(best_result)
}
