export interface Student {
  id: string
  name: string
  email?: string
}

export interface Restriction {
  id: string
  name: string
  startTime: string
  endTime: string
  studentIds: string[]
}

export interface StudentGroup {
  id: string
  name: string
  studentIds: string[]
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
