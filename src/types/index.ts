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
  id: string
  studentId: string
  subject: string
  date: string
}

export interface FutureSlot {
  id: string
  subject: string
  date: string
  time: string
  available: boolean
}

export interface Assignment {
  studentId: string
  slotId: string
  score: number
}
