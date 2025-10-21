export interface Student {
  id: string
  first_name: string
  last_name: string
  name: string
}

export interface Restriction {
  id: string
  activity_name: string
  start_time: string
  end_time: string
  student_ids: string[]
}

export interface StudentGroup {
  id: string
  name: string
  student_ids: string[]
}

export interface PastColle {
  name: string
  teachers: string[]
}

export interface FutureSlot {
  id: string
  teacher: string
  date: string // Format: YYYY/MM/DD
  start_hour: string // Format: HH:MM
  end_hour: string // Format: HH:MM
  subject: string
}

export interface Assignment {
  studentId: string
  slotId: string
  score: number
}
