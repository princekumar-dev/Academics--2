const PASS_THRESHOLD = 50
const ABSENT_TOKENS = ['AB', 'ABS', 'ABSENT']

const normalizeString = (value) => {
  if (typeof value === 'number') return value.toString().trim().toUpperCase()
  if (typeof value === 'string') return value.trim().toUpperCase()
  return ''
}

const normalizeResultToken = (value) => {
  const normalized = normalizeString(value)
  if (!normalized) return null
  if (ABSENT_TOKENS.includes(normalized)) return 'Absent'
  if (normalized === 'FAIL' || normalized === 'F') return 'Fail'
  if (normalized === 'PASS' || normalized === 'P') return 'Pass'
  return null
}

export const deriveResultFromGrade = (grade) => {
  const normalized = normalizeResultToken(grade)
  if (normalized) return normalized
  const gradeToken = normalizeString(grade)
  if (!gradeToken) return null
  if (ABSENT_TOKENS.includes(gradeToken)) return 'Absent'
  if (gradeToken.includes('F')) return 'Fail'
  return 'Pass'
}

export const deriveResultFromMarks = (marks) => {
  if (marks === undefined || marks === null) return null
  const numericMarks = Number(marks)
  if (Number.isNaN(numericMarks)) return null
  return numericMarks >= PASS_THRESHOLD ? 'Pass' : 'Fail'
}

export const deriveSubjectResult = (subject = {}) => {
  const direct = normalizeResultToken(subject.result)
  if (direct) return direct

  if (normalizeResultToken(subject.grade) === 'Absent') return 'Absent'

  const gradeBased = deriveResultFromGrade(subject.grade)
  if (gradeBased) return gradeBased

  const marksResult = deriveResultFromMarks(subject.marks)
  if (marksResult) return marksResult

  return 'Pass'
}

export const deriveOverallResult = (marksheetOrSubjects = {}) => {
  if (Array.isArray(marksheetOrSubjects)) {
    return computeOverallFromSubjects(marksheetOrSubjects)
  }

  const stored = normalizeResultToken(marksheetOrSubjects?.overallResult)
    || deriveResultFromGrade(marksheetOrSubjects?.overallGrade)
  if (stored) return stored

  const subjects = marksheetOrSubjects?.subjects || []
  if (subjects.length === 0) return 'Pass'

  return computeOverallFromSubjects(subjects)
}

const computeOverallFromSubjects = (subjects = []) => {
  if (!subjects.length) return 'Pass'
  let hasFail = false
  for (const subject of subjects) {
    const result = deriveSubjectResult(subject)
    if (result === 'Absent') return 'Absent'
    if (result === 'Fail') hasFail = true
  }
  return hasFail ? 'Fail' : 'Pass'
}

export { PASS_THRESHOLD, ABSENT_TOKENS }
