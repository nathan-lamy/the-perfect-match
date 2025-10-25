import type {
  CollesCount,
  FutureSlot,
  PastColle,
  Restriction,
  Student,
} from "@/types";
import { compareTimes, getDayOfWeek } from "./utils";
import { minWeightAssign } from "munkres-algorithm";

const RESTRICTION_PENALTY = 12_000_000; // Large penalty to avoid conflicts
const LAST_WEEK_PENALTY_BASE = 6_000_000; // Base penalty for last week conflicts
const SAME_DAY_PENALTY = 3_000; // Penalty for same day assignments
const TOTAL_COLLES_WEIGHT = 50; // Weight factor for total colles

const MAX_SCORE = RESTRICTION_PENALTY;
const MAX_RETRIES = 10;

const TIME_MARGIN = 31; // minutes
const PLACES_BY_SLOT = 3; // Number of students per slot

const makeComputeFunction = (
  restrictions: Restriction[],
  pastColles: PastColle[],
  totalColles: CollesCount,
  previousAssignments: { studentId: string; slot?: FutureSlot }[] = [],
  noiseFactor = 0
) => {
  const computeScore = (student: Student, slot: FutureSlot): number => {
    let score = 0;

    // Restriction penalty
    if (hasRestrictionConflict(student, slot, restrictions)) {
      score += RESTRICTION_PENALTY;
    }

    // Last week penalty (if same teacher and subject)
    const pastColle = pastColles.find(
      (pc) => pc.name === student.last_name + " " + student.first_name
    );
    if (pastColle) {
      if (pastColle.teachers.includes(slot.teacher)) {
        score += LAST_WEEK_PENALTY_BASE;
      }
    }

    // Same day penalty (if student has another slot on the same day)
    const hasSameDayAssignment = previousAssignments.some(
      (assignment) =>
        assignment.studentId === student.id &&
        assignment.slot &&
        assignment.slot.date === slot.date
    );
    if (hasSameDayAssignment) {
      score += SAME_DAY_PENALTY;
    }

    // Total colles penalty (based on counts with the slot's teacher)
    const studentCounts = totalColles.data.find(
      (sc) => sc.student === student.name
    );
    if (studentCounts) {
      const teacherIndex = totalColles.header.indexOf(slot.teacher);
      if (teacherIndex !== -1) {
        const countWithTeacher = studentCounts.counts[teacherIndex];
        score += countWithTeacher * TOTAL_COLLES_WEIGHT;
      }
    }

    // Noise (to randomize among equal scores)
    // Noise range: 0 to WEIGHT
    const noiseUpperBound = TOTAL_COLLES_WEIGHT * 2 ** noiseFactor;
    const noise = Math.floor(Math.random() * noiseUpperBound);
    score += noise;

    return score;
  };

  return computeScore;
};

const hasRestrictionConflict = (
  student: Student,
  slot: FutureSlot,
  restrictions: Restriction[]
): boolean => {
  for (const restriction of restrictions) {
    if (restriction.student_ids.includes(student.id)) {
      // Assuming restriction times are in a comparable format
      const isSameDay = getDayOfWeek(slot.date) === restriction.day;
      const hasCollision = !(
        compareTimes(slot.end_hour, restriction.start_time) <= -TIME_MARGIN ||
        compareTimes(slot.start_hour, restriction.end_time) >= TIME_MARGIN
      );
      if (isSameDay && hasCollision) {
        return true;
      }
    }
  }
  return false;
};

const makeMatrix = (
  students: Student[],
  slots: FutureSlot[],
  restrictions: Restriction[],
  pastColles: PastColle[],
  totalColles: CollesCount,
  previousAssignments: { studentId: string; slot?: FutureSlot }[] = [],
  noiseFactor = 0
): number[][] => {
  const computeScore = makeComputeFunction(
    restrictions,
    pastColles,
    totalColles,
    previousAssignments,
    noiseFactor
  );
  const matrix: number[][] = [];

  for (const slot of slots) {
    for (let i = 0; i < PLACES_BY_SLOT; i++) {
      const row: number[] = [];
      for (const student of students) {
        const score = computeScore(student, slot);
        row.push(score);
      }
      matrix.push(row);
    }
  }

  return matrix;
};

// Use munkres to get assignments from the cost matrix
// If the total score is above MAX_PENALTY, retry with twice the noise (MAX_RETRIES times)
const getAssignments = (
  students: Student[],
  mathColles: FutureSlot[],
  makeMatrix1: (noiseFactor: number) => number[][],
  makeMatrix2: (
    noiseFactor: number,
    newRestrictions: Restriction[],
    previousAssignments: Assignment[]
  ) => number[][]
) => {
  let noiseFactor = 0;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const matrix1 = makeMatrix1(noiseFactor);
    const { assignments: a1, assignmentsWeight: weight1 } =
      minWeightAssign(matrix1);

    console.log(weight1, MAX_SCORE);
    if (weight1 < MAX_SCORE) {
      const fa1 = formatAssignments(students, mathColles, a1).filter(
        (a) => a.slotId !== null
      );
      console.log(
        "First assignment successful:",
        fa1.map(({ slotId }) => mathColles.find((s) => s.id === slotId))
      );
      const matrix2 = makeMatrix2(
        noiseFactor,
        generateRestrictionsFromAssignments(students, mathColles, fa1),
        fa1
      );
      const { assignments: a2, assignmentsWeight: weight2 } =
        minWeightAssign(matrix2);

      console.log(weight2, MAX_SCORE);
      if (weight2 < MAX_SCORE) {
        return [
          {
            assignments: a1,
            totalScore: weight1,
          },
          {
            assignments: a2,
            totalScore: weight2,
          },
        ];
      }
    }

    noiseFactor += 1;
    console.log(
      `Retrying assignment with increased noise factor ${noiseFactor} (attempt ${
        attempt + 1
      }/${MAX_RETRIES})`
    );
  }
};

export type Assignment = { studentId: string; slotId: string | null };

export const formatAssignments = (
  students: Student[],
  slots: FutureSlot[],
  rawAssignments: (number | null)[]
): Assignment[] => {
  return rawAssignments.map((studentsIndex, slotIndex) => {
    if (studentsIndex === null) {
      return { studentId: "", slotId: null };
    }
    const student = students[studentsIndex];
    const slot = slots[Math.floor(slotIndex / PLACES_BY_SLOT)];
    return {
      studentId: student.id,
      slotId: slot.id,
    };
  });
};

export const generateRestrictionsFromAssignments = (
  students: Student[],
  slots: FutureSlot[],
  assignments: Assignment[]
): Restriction[] => {
  return assignments.map(({ studentId, slotId }) => {
    const student = students.find((s) => s.id === studentId);
    const slot = slots.find((s) => s.id === slotId)!;
    return {
      id: `auto-restriction-${slotId}-${studentId}`,
      activity_name: `Assigned Slot for ${student?.name || "Unknown"}`,
      start_time: slot.start_hour,
      end_time: slot.end_hour,
      student_ids: [studentId],
      day: getDayOfWeek(slot.date),
    };
  });
};

export const computeAssignments = (
  students: Student[],
  slots: FutureSlot[],
  restrictions: Restriction[],
  pastColles: PastColle[],
  mathCount: CollesCount,
  physGroup: string[], // student IDs for physics group
  physCount: CollesCount
) => {
  // Assign math colles first
  const mathColles = slots.filter((s) => s.subject === "Mathématiques");
  const makeMathMatrix = (noiseFactor: number) =>
    makeMatrix(
      students,
      mathColles,
      restrictions,
      pastColles,
      mathCount,
      [],
      noiseFactor
    );
  console.log("Math colles:", mathColles.length * PLACES_BY_SLOT);
  console.log("Students:", students.length);

  // Assign physics colles next
  const physColles = slots.filter((s) => s.subject === "Physique-Chimie");
  const makePhysMatrix = (
    noiseFactor: number,
    newRestrictions: Restriction[],
    previousAssignments: Assignment[]
  ) => {
    const physStudents = students.filter((s) => physGroup.includes(s.id));
    const mathAssignments = previousAssignments.map((pa) => ({
      studentId: pa.studentId,
      slot: slots.find((s) => s.id === pa.slotId)!,
    }));
    console.log("Previous math assignments:", mathAssignments);
    return makeMatrix(
      physStudents,
      physColles,
      newRestrictions,
      pastColles,
      physCount,
      mathAssignments,
      noiseFactor
    );
  };
  console.log("Physics colles:", physColles.length * PLACES_BY_SLOT);
  console.log("Physics students:", physGroup.length);

  // Get assignments
  const [mathResult, physResult] = getAssignments(
    students,
    mathColles,
    makeMathMatrix,
    makePhysMatrix
  )!;
  const mathAssignments = formatAssignments(
    students,
    mathColles,
    mathResult.assignments as number[]
  );
  const physStudents = students.filter((s) => physGroup.includes(s.id));
  const physAssignments = formatAssignments(
    physStudents,
    physColles,
    physResult.assignments as number[]
  );

  const missingMath = students.filter(
    (sq) => !mathAssignments.some((a) => a.studentId === sq.id)
  );
  const missingPhys = physStudents.filter(
    (sq) => !physAssignments.some((a) => a.studentId === sq.id)
  );
  console.log("Missing math assignments:", missingMath);
  console.log("Missing physics assignments:", missingPhys);

  return {
    math: {
      assignments: mathAssignments.filter((a) => a.slotId !== null),
      totalScore: mathResult.totalScore,
    },
    physics: {
      assignments: physAssignments.filter((a) => a.slotId !== null),
      totalScore: physResult.totalScore,
    },
  };
};
