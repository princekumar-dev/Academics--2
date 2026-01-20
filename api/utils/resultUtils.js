const PASS_MARK_THRESHOLD = 50
const ABSENT_TOKENS = ['AB', 'ABS', 'ABSENT']

const normalizeString = (value) => {
  if (typeof value === 'number') return value.toString().trim().toUpperCase()
  if (typeof value === 'string') return value.trim().toUpperCase()
  return ''
}

const normalizeResultToken = (value) => {
  const token = normalizeString(value)
  if (!token) return null
  if (ABSENT_TOKENS.includes(token)) return 'Absent'
  if (token === 'PASS' || token === 'P') return 'Pass'
  if (token === 'FAIL' || token === 'F') return 'Fail'
  return null
}

export const isAbsentValue = (value) => {
  if (value === undefined || value === null) return false
  return ABSENT_TOKENS.includes(normalizeString(value))
}

const deriveResultFromGrade = (grade) => {
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
  return numericMarks >= PASS_MARK_THRESHOLD ? 'Pass' : 'Fail'
}

export const deriveSubjectResult = (subject = {}) => {
  const direct = normalizeResultToken(subject.result)
  if (direct) return direct

  if (isAbsentValue(subject.grade) || isAbsentValue(subject.marks)) {
    return 'Absent'
  }

  const gradeResult = deriveResultFromGrade(subject.grade)
  if (gradeResult) return gradeResult

  const marksResult = deriveResultFromMarks(subject.marks)
  if (marksResult) return marksResult

  return 'Pass'
}

export const normalizeSubjectsWithResult = (subjects = []) => {
  return subjects.map((subject) => ({
    ...subject,
    result: deriveSubjectResult(subject)
  }))
}

export const deriveOverallResult = (marksheetOrSubjects = {}) => {
  const stored = normalizeResultToken(marksheetOrSubjects.overallResult)
  if (stored) return stored

  const gradeBased = deriveResultFromGrade(marksheetOrSubjects.overallGrade)
  if (gradeBased) return gradeBased

  const subjects = Array.isArray(marksheetOrSubjects)
    ? marksheetOrSubjects
    : (marksheetOrSubjects.subjects || [])

  if (!subjects.length) return 'Pass'

  let hasFail = false
  for (const subject of subjects) {
    const result = deriveSubjectResult(subject)
    if (result === 'Absent') return 'Absent'
    if (result === 'Fail') hasFail = true
  }

  return hasFail ? 'Fail' : 'Pass'
}

export const applyResultNormalization = (marksheet) => {
  if (!marksheet) return marksheet
  const normalizedSubjects = normalizeSubjectsWithResult(marksheet.subjects || [])
  const normalizedOverall = deriveOverallResult({
    ...marksheet,
    subjects: normalizedSubjects
  })

  marksheet.subjects = normalizedSubjects
  marksheet.overallResult = normalizedOverall
  return marksheet
}

export { PASS_MARK_THRESHOLD, ABSENT_TOKENS }
