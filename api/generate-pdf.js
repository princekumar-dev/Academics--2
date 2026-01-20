import { connectToDatabase } from '../lib/mongo.js'
import { Marksheet, LeaveRequest } from '../models.js'
import { applyResultNormalization } from './utils/resultUtils.js'
import PDFDocument from 'pdfkit'
import ExcelJS from 'exceljs'
import fs from 'fs'
import path from 'path'

// PDF cache to avoid regenerating identical PDFs
const pdfCache = new Map()
const CACHE_MAX_SIZE = 50
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Function to generate cache key
const getCacheKey = (marksheetId) => {
  return `pdf_${marksheetId}`
}


const LOGO_PATH = (() => {
  const logoPath = path.resolve(process.cwd(), 'public', 'images', 'mseclogo.png')
  return fs.existsSync(logoPath) ? logoPath : null
})()

// Function to expand department abbreviations to full names
const expandDepartmentName = (dept) => {
  const departmentMap = {
    'AI_DS': 'Artificial Intelligence and Data Science',
    'CSE': 'Computer Science and Engineering',
    'HNS': 'Humanities & Science (H&S)',
    'IT': 'Information Technology',
    'ECE': 'Electronics and Communication Engineering',
    'EEE': 'Electrical and Electronics Engineering',
    'MECH': 'Mechanical Engineering',
    'CIVIL': 'Civil Engineering'
  }
  
  return departmentMap[dept] || dept
}

const decodeBase64Image = (dataUrl) => {
  if (!dataUrl) return null
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
  try {
    return Buffer.from(base64, 'base64')
  } catch (err) {
    console.warn('Failed to decode base64 image for PDF:', err.message)
    return null
  }
}

// Function to generate Leave Approval Letter PDF
const generateLeavePDF = (leave) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 })
      const buffers = []
      const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right

      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers)
        resolve(pdfData)
      })

      const headerTop = doc.y - 20
      const logoWidth = 85
      const logoHeight = 95
      const headerGap = 20
      const textBlockX = doc.page.margins.left + logoWidth + headerGap
      const textBlockWidth = contentWidth - logoWidth - headerGap

      if (LOGO_PATH) {
        doc.image(LOGO_PATH, doc.page.margins.left, headerTop, { width: logoWidth, height: logoHeight })
      }

      let textCursorY = headerTop + 5
      const writeHeaderLine = (text, fontSize, fontName = 'Helvetica', spacing = 3, textOptions = {}) => {
        doc.font(fontName).fontSize(fontSize)
          .text(text, textBlockX, textCursorY, { width: textBlockWidth, align: 'center', ...textOptions })
        textCursorY = doc.y + spacing
      }

      const collegeName = 'MEENAKSHI SUNDARARAJAN ENGINEERING COLLEGE'
      let collegeFontSize = 15
      const minCollegeFontSize = 9
      doc.font('Helvetica-Bold')
      while (doc.fontSize(collegeFontSize).widthOfString(collegeName) > textBlockWidth && collegeFontSize > minCollegeFontSize) {
        collegeFontSize -= 0.5
      }
      writeHeaderLine(collegeName, collegeFontSize, 'Helvetica-Bold', 5)
      writeHeaderLine('(AN AUTONOMOUS INSTITUTION AFFILIATED TO ANNA UNIVERSITY)', 9, 'Helvetica', 3)
      writeHeaderLine('363, ARCOT ROAD, KODAMBAKKAM, CHENNAI-600024', 9, 'Helvetica', 8)
      writeHeaderLine('LEAVE APPROVAL LETTER', 12, 'Helvetica-Bold', 8)

      const headerBottom = Math.max(textCursorY, headerTop + logoHeight)
      doc.moveTo(doc.page.margins.left, headerBottom + 10).lineTo(doc.page.width - doc.page.margins.right, headerBottom + 10).lineWidth(1).stroke()
      doc.y = headerBottom + 30

      const infoRows = [
        { label: 'Student Name:', value: leave.studentDetails.name },
        { label: 'Register Number:', value: leave.studentDetails.regNumber },
        { label: 'Department:', value: `B.Tech ${expandDepartmentName(leave.studentDetails.department)}` },
        { label: 'Year/Section:', value: `${leave.studentDetails.year}/${leave.studentDetails.section}` },
        { label: 'Leave Period:', value: `${new Date(leave.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} to ${new Date(leave.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}` },
        { label: 'Reason:', value: leave.reason }
      ]
      const infoLabelWidth = 130
      const infoValueX = doc.page.margins.left + infoLabelWidth + 5
      const infoLineGap = 20
      infoRows.forEach((row) => {
        doc.font('Helvetica-Bold').fontSize(10.5)
          .text(row.label, doc.page.margins.left, doc.y, { width: infoLabelWidth, align: 'left' })
        doc.font('Helvetica').fontSize(10.5)
          .text(row.value, infoValueX, doc.y - 13, { width: contentWidth - infoLabelWidth - 5, align: 'left' })
        doc.y += infoLineGap
      })

      doc.moveDown(2)
      doc.font('Helvetica').fontSize(10.5)
        .text('This is to certify that the above student\'s leave request has been reviewed and approved by the Head of the Department.', {
          align: 'left'
        })

      const signatureY = doc.page.height - doc.page.margins.bottom - 70
      const signatureRightX = doc.page.width - doc.page.margins.right - 180
      const signatureWidth = 170
      
      const imageBuffer = decodeBase64Image(leave.hodSignature)
      if (imageBuffer) {
        doc.image(imageBuffer, signatureRightX, signatureY - 35, { fit: [signatureWidth - 10, 35], align: 'center' })
      }
      
      doc.lineWidth(0.5).moveTo(signatureRightX, signatureY).lineTo(signatureRightX + signatureWidth, signatureY).stroke()
      doc.fontSize(8.5).font('Helvetica').text('Signature of HOD', signatureRightX, signatureY + 4, { width: signatureWidth, align: 'center' })
      doc.fontSize(9).font('Helvetica-Bold').text(leave.hodName || 'HOD Name', signatureRightX, signatureY + 15, { width: signatureWidth, align: 'center' })

      doc.fontSize(7.5).fillColor('#666666')
        .text(`Generated on ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`, doc.page.margins.left, doc.page.height - doc.page.margins.bottom - 18, { width: contentWidth, align: 'right' })
      doc.fillColor('black')

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}

// Function to generate PDF using PDFKit
const generateMarksheetPDF = (marksheet, staffSignature, hodSignature, staffName, hodName) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 })
      const buffers = []
      const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
      
      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers)
        resolve(pdfData)
      })

      // Header area with logo left and centered text block on the right
      const headerTop = doc.y
      const logoWidth = 85
      const logoHeight = 95
      const headerGap = 20
      const textBlockX = doc.page.margins.left + logoWidth + headerGap
      const textBlockWidth = contentWidth - logoWidth - headerGap

      if (LOGO_PATH) {
        doc.image(LOGO_PATH, doc.page.margins.left, headerTop, {
          width: logoWidth,
          height: logoHeight
        })
      }

      let textCursorY = headerTop + 5
      const writeHeaderLine = (text, fontSize, fontName = 'Helvetica', spacing = 3, textOptions = {}) => {
        doc.font(fontName).fontSize(fontSize)
          .text(text, textBlockX, textCursorY, {
            width: textBlockWidth,
            align: 'center',
            ...textOptions
          })
        textCursorY = doc.y + spacing
      }

      // Ensure college name fits on a single line by adjusting font size if needed
      const collegeName = 'MEENAKSHI SUNDARARAJAN ENGINEERING COLLEGE';
      let collegeFontSize = 15;
      const minCollegeFontSize = 9;
      doc.font('Helvetica-Bold');
      // Reduce font size until the text fits in the textBlockWidth
      while (doc.fontSize(collegeFontSize).widthOfString(collegeName) > textBlockWidth && collegeFontSize > minCollegeFontSize) {
        collegeFontSize -= 0.5;
      }
      writeHeaderLine(collegeName, collegeFontSize, 'Helvetica-Bold', 5)
      writeHeaderLine('(AN AUTONOMOUS INSTITUTION AFFILIATED TO ANNA UNIVERSITY)', 9, 'Helvetica', 3)
      writeHeaderLine('363, ARCOT ROAD, KODAMBAKKAM, CHENNAI-600024', 9, 'Helvetica', 6)
      writeHeaderLine('OFFICE OF THE CONTROLLER OF EXAMINATIONS', 11, 'Helvetica-Bold', 6)

      const examDate = new Date(marksheet.examinationDate)
      const monthYear = `${examDate.toLocaleString('default', { month: 'long' }).toUpperCase()} - ${examDate.getFullYear()}`
      const examText = `${(marksheet.examinationName || 'END SEMESTER EXAMINATIONS').toUpperCase()} - ${monthYear}`
      writeHeaderLine(examText, 10, 'Helvetica-Bold', 0)

      const headerBottom = Math.max(textCursorY, headerTop + logoHeight)

      doc.moveTo(doc.page.margins.left, headerBottom + 10)
        .lineTo(doc.page.width - doc.page.margins.right, headerBottom + 10)
        .lineWidth(1)
        .stroke()

      doc.y = headerBottom + 22

      // Student Information with better spacing
      const infoRows = [
        { label: 'Register Number', value: marksheet.studentDetails.regNumber },
        { label: 'Student Name', value: marksheet.studentDetails.name },
        { label: 'Department', value: `B.Tech ${expandDepartmentName(marksheet.studentDetails.department)}` },
        { label: 'Year/Semester', value: `${marksheet.studentDetails.year}${marksheet.semester ? `/${marksheet.semester}` : ''}` }
      ]

      const infoLabelWidth = 130
      const infoValueX = doc.page.margins.left + infoLabelWidth + 10
      const infoLineGap = 10
      
      infoRows.forEach((row) => {
        const labelOptions = { width: infoLabelWidth }
        const valueOptions = { width: contentWidth - infoLabelWidth - 10 }

        doc.font('Helvetica-Bold').fontSize(10.5)
        const labelHeight = doc.heightOfString(`${row.label}:`, labelOptions)

        doc.font('Helvetica').fontSize(10.5)
        const valueHeight = doc.heightOfString(row.value, valueOptions)

        const rowHeight = Math.max(labelHeight, valueHeight)
        const rowY = doc.y

        doc.font('Helvetica-Bold').fontSize(10.5)
          .text(`${row.label}:`, doc.page.margins.left, rowY, labelOptions)
        doc.font('Helvetica').fontSize(10.5)
          .text(row.value, infoValueX, rowY, valueOptions)

        doc.y = rowY + rowHeight + infoLineGap
      })

      doc.moveDown(1)

      const tableTop = doc.y + 8
      const footerReserve = 150
      const subjects = marksheet.subjects || []
      const baseRowHeight = 32
      const rowFontSize = 10.5
      const columnPaddingX = 10
      const columnPaddingY = 8

      const getResultColor = (value) => {
        const normalized = (value || '').toString().toLowerCase()
        if (normalized === 'pass') return '#15803d' // green
        if (normalized === 'fail') return '#b91c1c' // red
        if (normalized === 'absent') return '#b45309' // amber
        return '#111111'
      }

      const columns = [
        { key: 'sno', label: 'S.No', width: 55, align: 'center' },
        { key: 'course', label: 'Course', width: contentWidth - 225, align: 'left' },
        { key: 'mark', label: 'Marks', width: 85, align: 'center' },
        { key: 'result', label: 'Result', width: 85, align: 'center' }
      ]

      let currentX = doc.page.margins.left
      columns.forEach((col) => {
        col.x = currentX
        currentX += col.width
      })

      const measureCellHeight = (text, col) => {
        const cellText = `${text ?? ''}`
        return doc.heightOfString(cellText, {
          width: col.width - columnPaddingX * 2,
          align: col.align || 'left'
        })
      }

      const getRowHeight = (rowValues) => {
        let maxHeight = 0
        columns.forEach((col) => {
          doc.font('Helvetica').fontSize(rowFontSize)
          maxHeight = Math.max(maxHeight, measureCellHeight(rowValues[col.key], col))
        })
        return Math.max(baseRowHeight, maxHeight + columnPaddingY * 2)
      }

      let currentY = tableTop

      // Draw table header with better styling
      const headerRowHeight = 35
      
      // Draw header background
      doc.fillColor('#e8e8e8')
        .rect(doc.page.margins.left, currentY, contentWidth, headerRowHeight)
        .fill()
      doc.fillColor('#000000')
      
      // Draw header borders (thicker)
      doc.lineWidth(1.5)
        .rect(doc.page.margins.left, currentY, contentWidth, headerRowHeight)
        .stroke()
      doc.lineWidth(1)
      
      // Draw vertical lines for header
      columns.forEach((col, index) => {
        if (index < columns.length - 1) {
          doc.moveTo(col.x + col.width, currentY)
            .lineTo(col.x + col.width, currentY + headerRowHeight)
            .stroke()
        }
        
        // Draw header text with vertical centering
        doc.font('Helvetica-Bold').fontSize(11)
        const textHeight = doc.heightOfString(col.label, {
          width: col.width - columnPaddingX * 2,
          align: col.align || 'center'
        })
        const textY = currentY + (headerRowHeight - textHeight) / 2
        
        doc.text(col.label, col.x + columnPaddingX, textY, {
          width: col.width - columnPaddingX * 2,
          align: col.align || 'center',
          lineBreak: false
        })
      })

      currentY += headerRowHeight

      // Draw data rows
      subjects.forEach((subject, index) => {
        const rowValues = {
          sno: index + 1,
          course: subject.subjectName,
          mark: subject.marks,
          result: subject.result || '—'
        }

        const rowHeight = getRowHeight(rowValues)
        
        // Draw row border
        doc.rect(doc.page.margins.left, currentY, contentWidth, rowHeight).stroke()

        // Draw vertical lines and cell content
        columns.forEach((col, colIndex) => {
          if (colIndex < columns.length - 1) {
            doc.moveTo(col.x + col.width, currentY)
              .lineTo(col.x + col.width, currentY + rowHeight)
              .stroke()
          }
          
          // Draw cell text with vertical centering
          doc.font('Helvetica').fontSize(rowFontSize)
          const cellText = `${rowValues[col.key] ?? ''}`
          const textHeight = doc.heightOfString(cellText, {
            width: col.width - columnPaddingX * 2,
            align: col.align || 'left'
          })
          const textY = currentY + (rowHeight - textHeight) / 2
          
          if (col.key === 'result') {
            doc.fillColor(getResultColor(cellText))
          } else {
            doc.fillColor('#000000')
          }
          doc.text(cellText, col.x + columnPaddingX, textY, {
            width: col.width - columnPaddingX * 2,
            align: col.align || 'left',
            lineBreak: false
          })
        })

        currentY += rowHeight
      })

      const tableBottom = currentY + 12
      
      // Overall result and total subjects with better spacing
      doc.moveDown(0.5)
      const overallResultText = marksheet.overallResult || '—'
      doc.fontSize(11).font('Helvetica-Bold')
        .fillColor('#000000')
        .text('Overall Result: ', doc.page.margins.left, tableBottom, {
          width: contentWidth / 2,
          align: 'left',
          continued: true
        })
      doc.fillColor(getResultColor(overallResultText))
        .text(overallResultText, {
          continued: false
        })
      doc.fillColor('#000000')
      doc.font('Helvetica').fontSize(11)
        .text(`Total Subjects: ${subjects.length}`, doc.page.margins.left + contentWidth / 2, tableBottom, {
          width: contentWidth / 2,
          align: 'right'
        })

      // Signature section with more spacing from content
      const signatureY = doc.page.height - doc.page.margins.bottom - 70
      const slotWidth = contentWidth / 2
      const signatureSlots = [
        { label: 'Signature of Staff', name: staffName || 'Staff Name', image: staffSignature },
        { label: 'Signature of HOD', name: hodName || 'HOD Name', image: hodSignature }
      ]

      signatureSlots.forEach((slot, index) => {
        const slotX = doc.page.margins.left + index * slotWidth
        const imageBuffer = decodeBase64Image(slot.image)
        if (imageBuffer) {
          doc.image(imageBuffer, slotX + 15, signatureY - 50, {
            fit: [slotWidth - 30, 42],
            align: 'center'
          })
        }

        // Signature line
        doc.lineWidth(0.5)
          .moveTo(slotX + 12, signatureY)
          .lineTo(slotX + slotWidth - 12, signatureY)
          .stroke()
        doc.lineWidth(1)

        // Signature label
        doc.fontSize(8.5).font('Helvetica')
          .text(slot.label, slotX + 12, signatureY + 5, {
            width: slotWidth - 24,
            align: 'center'
          })
        
        // Name below signature line with better spacing
        doc.fontSize(9).font('Helvetica-Bold')
          .text(slot.name, slotX + 12, signatureY + 18, {
            width: slotWidth - 24,
            align: 'center'
          })
      })

      // Footer timestamp
      doc.fontSize(7.5).fillColor('#666666')
        .text(`Generated on ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`, doc.page.margins.left, doc.page.height - doc.page.margins.bottom - 18, {
          width: contentWidth,
          align: 'right'
        })
      doc.fillColor('black')

      doc.end()
      
    } catch (error) {
      reject(error)
    }
  })
}

// Handles consolidated report exports (moved from /api/export-reports)
async function handleReportExport(req, res) {
  try {
    const { type, data, format, department, generatedBy, generatedAt, metadata = {} } = req.body

    if (!type || !data || !format) {
      return res.status(400).json({ success: false, error: 'Missing required fields' })
    }

    const safeGeneratedAt = generatedAt || new Date().toISOString()
    const filename = `${type}_${department || 'report'}_${new Date().toISOString().split('T')[0]}`
    const reportMeta = {
      reportTitle: metadata.reportTitle || 'Report',
      departmentName: metadata.departmentName || department || 'Department',
      ...metadata
    }

    switch (format.toLowerCase()) {
      case 'pdf':
        await generateReportPDF(res, { type, data, metadata: reportMeta, filename, generatedBy, generatedAt: safeGeneratedAt })
        return
      case 'excel':
        await generateReportExcel(res, { type, data, metadata: reportMeta, filename, generatedBy, generatedAt: safeGeneratedAt })
        return
      case 'csv':
        await generateReportCSV(res, { type, data, metadata: reportMeta, filename, generatedBy, generatedAt: safeGeneratedAt })
        return
      default:
        return res.status(400).json({ success: false, error: 'Unsupported format' })
    }
  } catch (error) {
    console.error('Export error:', error)
    return res.status(500).json({ success: false, error: 'Export failed' })
  }
}

async function generateReportPDF(res, { type, data, metadata, filename, generatedBy, generatedAt }) {
  const doc = new PDFDocument({ margin: 50 })

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`)

  doc.pipe(res)

  doc.fontSize(20).text(metadata.reportTitle, { align: 'center' })
  doc.fontSize(12).text(`Department: ${metadata.departmentName}`, { align: 'center' })
  doc.fontSize(10).text(`Generated by: ${generatedBy || 'System'} on ${new Date(generatedAt).toLocaleString()}`, { align: 'center' })
  doc.moveDown(2)

  switch (type) {
    case 'department-summary':
      generateDepartmentSummaryPDF(doc, data)
      break
    case 'classwise-performance':
      generateClasswisePerformancePDF(doc, data)
      break
    case 'failed-dispatches':
      generateFailedDispatchesPDF(doc, data)
      break
    case 'subject-analysis':
      generateSubjectAnalysisPDF(doc, data)
      break
  }

  doc.end()
}

function normalizeClasswiseData(data) {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (typeof data === 'object') {
    // If the object keys are class names, add classKey to each
    return Object.entries(data).map(([classKey, value]) => ({
      classKey,
      ...value
    }))
  }
  return []
}

function drawCard(doc, { x, y, width, height, title, value, icon, iconColor }) {
  doc.save()
  doc.roundedRect(x, y, width, height, 12)
    .fillOpacity(1)
    .fill('#ffffff')
  doc.lineWidth(1).strokeColor('#f4efe5').roundedRect(x, y, width, height, 12).stroke()
  doc.fillColor('#a1a1aa').fontSize(11).text(title, x + 16, y + 14, { width: width - 32 })
  if (icon) {
    doc.circle(x + width - 26, y + 18, 10).fill(iconColor || '#fbbf24')
    doc.fillColor('#ffffff').fontSize(12).text(icon, x + width - 31, y + 11)
  }
  doc.fillColor('#111827').fontSize(22).font('Helvetica-Bold')
    .text(value, x + 16, y + 34)
  doc.restore()
}

function renderListSection(doc, { title, data = [], colors = {} }) {
  const startY = doc.y
  doc.save()
  doc.roundedRect(doc.page.margins.left, startY, doc.page.width - doc.page.margins.left - doc.page.margins.right, 20, 10)
    .fillOpacity(1).fill('#fff8ee')
  doc.fillColor('#c084fc').fontSize(13).font('Helvetica-Bold')
    .text(title, doc.page.margins.left + 16, startY + 4)
  doc.restore()
  doc.moveDown(1.4)
  data.forEach(item => {
    doc.circle(doc.page.margins.left + 10, doc.y + 8, 3).fill(colors.dot || '#f59e0b')
    doc.fillColor('#111827').fontSize(12).text(item.label, doc.page.margins.left + 24, doc.y, { continued: true })
    doc.fillColor('#4338ca').text(item.value, { align: 'right' })
  })
  doc.moveDown()
}

function generateDepartmentSummaryPDF(doc, data) {
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text('Department Summary', { align: 'left' })
  doc.moveDown(0.3)
  doc.font('Helvetica').fontSize(11).fillColor('#6b7280').text(`Generated on ${new Date().toLocaleString()}`)
  doc.moveDown(1)

  const cardWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right - 30) / 4
  const cardHeight = 70
  const statuses = [
    { title: 'Total', value: data.totalStudents || 0, icon: '●', color: '#f97316' },
    { title: 'Dispatched', value: data.byStatus?.dispatched || 0, icon: '✓', color: '#10b981' },
    { title: 'Pending', value: data.byStatus?.pending || 0, icon: '⏱', color: '#fbbf24' },
    { title: 'Rejected', value: data.byStatus?.rejected || 0, icon: '✕', color: '#ef4444' }
  ]
  let currentX = doc.page.margins.left
  const cardY = doc.y
  statuses.forEach((card) => {
    drawCard(doc, {
      x: currentX,
      y: cardY,
      width: cardWidth,
      height: cardHeight,
      title: card.title,
      value: card.value,
      icon: card.icon,
      iconColor: card.color
    })
    currentX += cardWidth + 10
  })
  doc.y = cardY + cardHeight + 25

  if (Array.isArray(data.yearWiseBreakdown) && data.yearWiseBreakdown.length > 0) {
    const yearList = data.yearWiseBreakdown.map(year => ({
      label: `Year ${year._id}`,
      value: year.count
    }))
    renderListSection(doc, { title: 'Year-wise Distribution', data: yearList, colors: { dot: '#f97316' } })
  }

  const overallResults = data.overallResults || data.overallGrades || {}
  if (overallResults && Object.keys(overallResults).length > 0) {
    const resultList = Object.entries(overallResults).map(([result, count]) => ({
      label: `Result ${result}`,
      value: count
    }))
    renderListSection(doc, { title: 'Result Distribution', data: resultList, colors: { dot: '#a855f7' } })
  }
}

function generateClasswisePerformancePDF(doc, rawData) {
  const data = normalizeClasswiseData(rawData)
  if (data.length === 0) {
    doc.text('No classwise performance data available.')
    return
  }

  doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text('Class-wise Performance', { align: 'left' })
  doc.moveDown(0.3)
  doc.font('Helvetica').fontSize(11).fillColor('#6b7280').text(`Generated on ${new Date().toLocaleString()}`)
  doc.moveDown(1)

  data.forEach(classData => {
    const cardWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
    const cardHeight = 110
    const startY = doc.y
    doc.save()
    doc.roundedRect(doc.page.margins.left, startY, cardWidth, cardHeight, 18)
      .fillOpacity(1).fill('#ffffff')
    doc.lineWidth(1).strokeColor('#f1f5f9').roundedRect(doc.page.margins.left, startY, cardWidth, cardHeight, 18).stroke()

    const classLabel = classData.classKey || `${classData.branch || 'Class'} ${classData.section || ''}`
    doc.fillColor('#16a34a').fontSize(11).text('🏫', doc.page.margins.left + 18, startY + 18)
    doc.fillColor('#111827').fontSize(13).font('Helvetica-Bold')
      .text(classLabel, doc.page.margins.left + 40, startY + 16, { width: cardWidth / 2 })
    doc.fillColor('#6b7280').font('Helvetica').fontSize(11)
      .text(`Year ${classData.year || '-'}` + (classData.section ? ` • Section ${classData.section}` : ''), doc.page.margins.left + 40, startY + 33)

    doc.fillColor('#22c55e').fontSize(10).text(`${classData.totalStudents} Students`, doc.page.margins.left + cardWidth - 140, startY + 18)
    doc.fillColor('#f59e0b').text(`${classData.dispatchRate}% Dispatched`, doc.page.margins.left + cardWidth - 140, startY + 32)

    const metricsY = startY + 60
    const metrics = [
      { label: 'Total', value: classData.totalStudents, color: '#10b981' },
      { label: 'Dispatched', value: classData.dispatched, color: '#2563eb' },
      { label: 'Pending', value: classData.pending, color: '#f59e0b' }
    ]
    let metricX = doc.page.margins.left + 20
    metrics.forEach(metric => {
      doc.fillColor('#6b7280').fontSize(10).text(metric.label, metricX, metricsY)
      doc.fillColor(metric.color).fontSize(16).font('Helvetica-Bold').text(metric.value, metricX, metricsY + 12)
      metricX += 110
    })

    const classResults = classData.resultDistribution || classData.gradeDistribution || {}
    if (classResults && Object.keys(classResults).length > 0) {
      doc.fillColor('#9333ea').font('Helvetica-Bold').fontSize(11)
        .text('Result Distribution', doc.page.margins.left + cardWidth - 200, metricsY)
      doc.font('Helvetica').fontSize(10).fillColor('#4c1d95')
      Object.entries(classResults).forEach(([result, count], idx) => {
        doc.text(`${result}: ${count}`, doc.page.margins.left + cardWidth - 200, metricsY + 14 + (idx * 12))
      })
    }

    doc.restore()
    doc.moveDown(4)
  })
}

function generateFailedDispatchesPDF(doc, data = []) {
  const list = Array.isArray(data) ? data : []
  doc.fontSize(14).text('Failed Dispatches Report', { underline: true })
  doc.moveDown()

  if (list.length === 0) {
    doc.text('No failed dispatches found.')
    return
  }

  list.forEach((marksheet, index) => {
    doc.fontSize(10)
    doc.text(`${index + 1}. ${marksheet.studentName} (${marksheet.registerNumber})`)
    doc.text(`   Branch: ${marksheet.branch}, Year: ${marksheet.year}`)
    doc.text(`   Attempts: ${marksheet.dispatchAttempts}`)
    doc.text(`   Last Attempt: ${new Date(marksheet.lastDispatchAttempt).toLocaleDateString()}`)
    doc.moveDown(0.3)
  })
}

function generateSubjectAnalysisPDF(doc, data = []) {
  const list = normalizeSubjectData(data)
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text('Subject Analysis', { align: 'left' })
  doc.moveDown(0.3)
  doc.font('Helvetica').fontSize(11).fillColor('#6b7280').text(`Generated on ${new Date().toLocaleString()}`)
  doc.moveDown(1)

  if (list.length === 0) {
    doc.text('No subject analysis data available.')
    return
  }

  list.forEach(subject => {
    const cardWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
    const cardHeight = 100
    const startY = doc.y

    doc.save()
    doc.roundedRect(doc.page.margins.left, startY, cardWidth, cardHeight, 16)
      .fillOpacity(1).fill('#ffffff')
    doc.lineWidth(1).strokeColor('#ede9fe').roundedRect(doc.page.margins.left, startY, cardWidth, cardHeight, 16).stroke()

    doc.fillColor('#a855f7').fontSize(13).text('📘', doc.page.margins.left + 16, startY + 18)
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(13)
      .text(subject.subjectName, doc.page.margins.left + 40, startY + 16, { width: cardWidth / 2 })
    doc.font('Helvetica').fontSize(10).fillColor('#6b7280')
      .text(`Subject Code: ${subject.subjectCode || 'N/A'}`, doc.page.margins.left + 40, startY + 34)

    doc.fillColor('#d946ef').fontSize(10).text(`${subject.totalEnrollments || 0} Students`, doc.page.margins.left + cardWidth - 130, startY + 22)

    const avgValue = typeof subject.average === 'number'
      ? subject.average.toFixed(1)
      : (subject.average ?? subject.averageMarks ?? '-')

    const passRateRaw = subject.passingRate ?? subject.passRate ?? 0
    const passRate = typeof passRateRaw === 'number'
      ? passRateRaw.toFixed(1)
      : passRateRaw

    const metrics = [
      { label: 'Average', value: avgValue, color: '#6366f1' },
      { label: 'Highest', value: subject.highest ?? '-', color: '#16a34a' },
      { label: 'Lowest', value: subject.lowest ?? '-', color: '#dc2626' },
      { label: 'Pass Rate', value: `${passRate}%`, color: '#f59e0b' }
    ]

    let metricX = doc.page.margins.left + 30
    const metricY = startY + 60
    metrics.forEach(metric => {
      doc.fillColor('#6b7280').fontSize(10).text(metric.label, metricX, metricY)
      doc.fillColor(metric.color).font('Helvetica-Bold').fontSize(14).text(metric.value, metricX, metricY + 12)
      metricX += 120
    })

    doc.restore()
    doc.moveDown(3.5)
  })
}

async function generateReportExcel(res, { type, data, metadata, filename, generatedBy, generatedAt }) {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Report')

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`)

  const headerStyle = {
    font: { bold: true, size: 14 },
    alignment: { horizontal: 'center' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6FA' } }
  }

  worksheet.addRow([metadata.reportTitle])
  worksheet.getRow(1).font = { bold: true, size: 16 }
  worksheet.getRow(1).alignment = { horizontal: 'center' }

  worksheet.addRow([`Department: ${metadata.departmentName}`])
  worksheet.addRow([`Generated by: ${generatedBy || 'System'} on ${new Date(generatedAt).toLocaleString()}`])
  worksheet.addRow([])

  switch (type) {
    case 'department-summary':
      generateDepartmentSummaryExcel(worksheet, data, headerStyle)
      break
    case 'classwise-performance':
      generateClasswisePerformanceExcel(worksheet, data, headerStyle)
      break
    case 'failed-dispatches':
      generateFailedDispatchesExcel(worksheet, data, headerStyle)
      break
    case 'subject-analysis':
      generateSubjectAnalysisExcel(worksheet, data, headerStyle)
      break
  }

  worksheet.columns.forEach(column => {
    column.width = Math.max(10, column.width || 0)
  })

  await workbook.xlsx.write(res)
  res.end()
}

function generateDepartmentSummaryExcel(worksheet, data, headerStyle) {
  worksheet.addRow(['Summary Statistics'])
  worksheet.getRow(worksheet.rowCount).style = headerStyle

  worksheet.addRow(['Metric', 'Count'])
  worksheet.addRow(['Total Students', data.totalStudents])
  worksheet.addRow(['Total Marksheets', data.totalMarksheets])
  worksheet.addRow(['Dispatched', data.dispatched])
  worksheet.addRow(['Pending', data.pending])
  worksheet.addRow(['Failed', data.failed])

  if (data.yearWiseBreakdown && data.yearWiseBreakdown.length > 0) {
    worksheet.addRow([])
    worksheet.addRow(['Year-wise Breakdown'])
    worksheet.getRow(worksheet.rowCount).style = headerStyle

    worksheet.addRow(['Year', 'Students', 'Marksheets'])
    data.yearWiseBreakdown.forEach(year => {
      worksheet.addRow([year._id, year.count, year.marksheets])
    })
  }
}

function generateClasswisePerformanceExcel(worksheet, rawData, headerStyle) {
  const data = normalizeClasswiseData(rawData)
  worksheet.addRow(['Branch', 'Year', 'Total Students', 'Dispatched', 'Pending', 'Dispatch Rate (%)'])
  worksheet.getRow(worksheet.rowCount).style = headerStyle

  if (data.length === 0) {
    worksheet.addRow(['N/A', 'N/A', 0, 0, 0, 0])
    return
  }

  data.forEach(classData => {
    worksheet.addRow([
      classData.branch || classData.classKey || 'Class',
      classData.year || '—',
      classData.totalStudents,
      classData.dispatched,
      classData.pending,
      classData.dispatchRate
    ])
  })
}

function generateFailedDispatchesExcel(worksheet, data, headerStyle) {
  const list = Array.isArray(data) ? data : []
  if (list.length === 0) {
    worksheet.addRow(['No failed dispatches found'])
    return
  }

  worksheet.addRow(['Student Name', 'Register Number', 'Branch', 'Year', 'Attempts', 'Last Attempt'])
  worksheet.getRow(worksheet.rowCount).style = headerStyle

  list.forEach(marksheet => {
    worksheet.addRow([
      marksheet.studentName,
      marksheet.registerNumber,
      marksheet.branch,
      marksheet.year,
      marksheet.dispatchAttempts,
      new Date(marksheet.lastDispatchAttempt).toLocaleDateString()
    ])
  })
}

function generateSubjectAnalysisExcel(worksheet, data, headerStyle) {
  const list = normalizeSubjectData(data)
  worksheet.addRow(['Subject Name', 'Subject Code', 'Total Enrollments', 'Pass Rate (%)', 'Average Marks'])
  worksheet.getRow(worksheet.rowCount).style = headerStyle

  if (list.length === 0) {
    worksheet.addRow(['No subject data available'])
    return
  }

  list.forEach(subject => {
    const averageMarksValue = typeof subject.average === 'number'
      ? subject.average.toFixed(1)
      : (subject.average ?? subject.averageMarks ?? '-')

    worksheet.addRow([
      subject.subjectName,
      subject.subjectCode,
      subject.totalEnrollments,
      subject.passRate,
      averageMarksValue
    ])
  })
}

async function generateReportCSV(res, { type, data, metadata, filename, generatedBy, generatedAt }) {
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`)

  let csvContent = `${metadata.reportTitle}\n`
  csvContent += `Department: ${metadata.departmentName}\n`
  csvContent += `Generated by: ${generatedBy || 'System'} on ${new Date(generatedAt).toLocaleString()}\n\n`

  switch (type) {
    case 'department-summary':
      csvContent += generateDepartmentSummaryCSV(data)
      break
    case 'classwise-performance':
      csvContent += generateClasswisePerformanceCSV(data)
      break
    case 'failed-dispatches':
      csvContent += generateFailedDispatchesCSV(data)
      break
    case 'subject-analysis':
      csvContent += generateSubjectAnalysisCSV(data)
      break
  }

  res.send(csvContent)
}

function generateDepartmentSummaryCSV(data) {
  let csv = 'Summary Statistics\n'
  csv += 'Metric,Count\n'
  csv += `Total Students,${data.totalStudents}\n`
  csv += `Total Marksheets,${data.totalMarksheets}\n`
  csv += `Dispatched,${data.dispatched}\n`
  csv += `Pending,${data.pending}\n`
  csv += `Failed,${data.failed}\n\n`

  if (data.yearWiseBreakdown && data.yearWiseBreakdown.length > 0) {
    csv += 'Year-wise Breakdown\n'
    csv += 'Year,Students,Marksheets\n'
    data.yearWiseBreakdown.forEach(year => {
      csv += `${year._id},${year.count},${year.marksheets}\n`
    })
  }

  return csv
}

function generateClasswisePerformanceCSV(rawData) {
  const data = normalizeClasswiseData(rawData)
  let csv = 'Branch,Year,Total Students,Dispatched,Pending,Dispatch Rate (%)\n'

  if (data.length === 0) {
    csv += 'N/A,N/A,0,0,0,0\n'
    return csv
  }

  data.forEach(classData => {
    csv += `"${classData.branch || classData.classKey}",${classData.year || ''},${classData.totalStudents},${classData.dispatched},${classData.pending},${classData.dispatchRate}\n`
  })

  return csv
}

function generateFailedDispatchesCSV(data) {
  if (data.length === 0) {
    return 'No failed dispatches found\n'
  }

  let csv = 'Student Name,Register Number,Branch,Year,Attempts,Last Attempt\n'

  data.forEach(marksheet => {
    csv += `"${marksheet.studentName}","${marksheet.registerNumber}","${marksheet.branch}",${marksheet.year},${marksheet.dispatchAttempts},"${new Date(marksheet.lastDispatchAttempt).toLocaleDateString()}"\n`
  })

  return csv
}

function generateSubjectAnalysisCSV(data) {
  const list = normalizeSubjectData(data)
  let csv = 'Subject Name,Subject Code,Total Enrollments,Pass Rate (%),Average Marks\n'

  if (list.length === 0) {
    csv += 'N/A,N/A,0,0,0\n'
    return csv
  }

  list.forEach(subject => {
    const averageMarksValue = typeof subject.average === 'number'
      ? subject.average.toFixed(1)
      : (subject.average ?? subject.averageMarks ?? subject.averageGrade ?? '-')

    csv += `"${subject.subjectName}","${subject.subjectCode}",${subject.totalEnrollments},${subject.passRate},"${averageMarksValue}"\n`
  })

  return csv
}


export default async function handler(req, res) {
  // Health check: respond to ?health=true or ?test=true with 200 OK
  if (req.method === 'GET' && req.query && (req.query.health === 'true' || req.query.test === 'true')) {
    return res.status(200).json({ status: 'ok', time: new Date().toISOString() })
  }

  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    await connectToDatabase()
  } catch (dbErr) {
    console.error('DB connect error in generate-pdf API:', dbErr.message)
    return res.status(503).json({ success: false, error: 'Database connection failed' })
  }

  try {
    if (req.method === 'GET') {
      const { marksheetId, leaveId, type, format } = req.query
      const outputFormat = (format || 'pdf').toLowerCase()

      if (type === 'leave') {
        if (!leaveId) {
          return res.status(400).json({ success: false, error: 'leaveId is required' })
        }
        const leave = await LeaveRequest.findById(leaveId).lean()
        if (!leave) return res.status(404).json({ success: false, error: 'Leave request not found' })
        try {
          const pdfBuffer = await generateLeavePDF(leave)
          if (outputFormat === 'jpeg' || outputFormat === 'jpg' || outputFormat === 'image') {
            const jpegBuffer = await convertPdfToJpeg(pdfBuffer)
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            res.setHeader('Pragma', 'no-cache')
            res.setHeader('Expires', '0')
            res.setHeader('Content-Type', 'image/jpeg')
            res.setHeader('Content-Disposition', `inline; filename="leave_${leave.studentDetails.regNumber}.jpg"`)
            res.setHeader('Content-Length', jpegBuffer.length)
            return res.status(200).send(jpegBuffer)
          }
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
          res.setHeader('Pragma', 'no-cache')
          res.setHeader('Expires', '0')
          res.setHeader('Content-Type', 'application/pdf')
          res.setHeader('Content-Disposition', `attachment; filename="leave_${leave.studentDetails.regNumber}.pdf"`)
          res.setHeader('Content-Length', pdfBuffer.length)
          return res.status(200).send(pdfBuffer)
        } catch (pdfErr) {
          console.error('Leave PDF generation error:', pdfErr)
          return res.status(500).json({ success: false, error: 'Failed to generate leave letter' })
        }
      }

      if (!marksheetId) {
        return res.status(400).json({ success: false, error: 'marksheetId is required' })
      }

      // Get marksheet data
      const marksheetRaw = await Marksheet.findById(marksheetId)
        .populate('staffId')
        .populate('hodId')
        .lean()
      const marksheet = marksheetRaw ? applyResultNormalization(marksheetRaw) : null
      if (!marksheet) {
        return res.status(404).json({ success: false, error: 'Marksheet not found' })
      }

      // Check cache first
      const cacheKey = getCacheKey(marksheetId)
      const cached = pdfCache.get(cacheKey)
      
      if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        console.log('Serving cached PDF for:', marksheetId)
        if (outputFormat === 'jpeg' || outputFormat === 'jpg' || outputFormat === 'image') {
          try {
            const jpegBuffer = await convertPdfToJpeg(cached.buffer)
            // Prevent browser caching so regenerated PDFs are always requested
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            res.setHeader('Pragma', 'no-cache')
            res.setHeader('Expires', '0')
            res.setHeader('Content-Type', 'image/jpeg')
            res.setHeader('Content-Disposition', `inline; filename="marksheet_${marksheet.studentDetails.regNumber}_${marksheet.marksheetId}.jpg"`)
            res.setHeader('Content-Length', jpegBuffer.length)
            res.setHeader('X-Cache', 'HIT')
            return res.status(200).send(jpegBuffer)
          } catch (err) {
            console.error('JPEG conversion error (cache):', err)
          }
        }
        // Prevent browser caching so regenerated PDFs are always requested
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        res.setHeader('Pragma', 'no-cache')
        res.setHeader('Expires', '0')
        res.setHeader('Content-Type', 'application/pdf')
        res.setHeader('Content-Disposition', `attachment; filename="marksheet_${marksheet.studentDetails.regNumber}_${marksheet.marksheetId}.pdf"`)
        res.setHeader('Content-Length', cached.buffer.length)
        res.setHeader('X-Cache', 'HIT')
        return res.status(200).send(cached.buffer)
      }

      // Get signatures and names. Prefer signatures stored on the marksheet
      // (these are refreshed by the regenerate flow) and fall back to the
      // user's profile signature if the marksheet field is not present.
      const staffData = marksheet.staffId
      const staffSignature = (marksheet.staffSignature && marksheet.staffSignature.length > 0)
        ? marksheet.staffSignature
        : (staffData?.eSignature || null)
      const staffName = marksheet.staffName || staffData?.name || 'Staff Name'
      const hodData = marksheet.hodId
      const hodSignature = (marksheet.hodSignature && marksheet.hodSignature.length > 0)
        ? marksheet.hodSignature
        : (hodData?.eSignature || null)
      const hodName = marksheet.hodName || hodData?.name || 'HOD Name'
      const principalSignature = process.env.PRINCIPAL_SIGNATURE_URL || null

      try {
        // Generate PDF using PDFKit
        const pdfBuffer = await generateMarksheetPDF(marksheet, staffSignature, hodSignature, staffName, hodName)

        // Cache the PDF
        if (pdfCache.size >= CACHE_MAX_SIZE) {
          const firstKey = pdfCache.keys().next().value
          pdfCache.delete(firstKey)
        }
        pdfCache.set(cacheKey, {
          buffer: pdfBuffer,
          timestamp: Date.now()
        })

        if (outputFormat === 'jpeg' || outputFormat === 'jpg' || outputFormat === 'image') {
          try {
            const jpegBuffer = await convertPdfToJpeg(pdfBuffer)
            // Prevent browser caching so regenerated PDFs are always requested
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            res.setHeader('Pragma', 'no-cache')
            res.setHeader('Expires', '0')
            res.setHeader('Content-Type', 'image/jpeg')
            res.setHeader('Content-Disposition', `inline; filename="marksheet_${marksheet.studentDetails.regNumber}_${marksheet.marksheetId}.jpg"`)
            res.setHeader('Content-Length', jpegBuffer.length)
            res.setHeader('X-Cache', 'MISS')
            return res.status(200).send(jpegBuffer)
          } catch (err) {
            console.error('JPEG conversion error:', err)
          }
        }

        // Set response headers for PDF
        // Prevent browser caching so regenerated PDFs are always requested
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        res.setHeader('Pragma', 'no-cache')
        res.setHeader('Expires', '0')
        res.setHeader('Content-Type', 'application/pdf')
        res.setHeader('Content-Disposition', `attachment; filename="marksheet_${marksheet.studentDetails.regNumber}_${marksheet.marksheetId}.pdf"`)
        res.setHeader('Content-Length', pdfBuffer.length)
        res.setHeader('X-Cache', 'MISS')

        return res.status(200).send(pdfBuffer)

      } catch (pdfError) {
        console.error('PDF generation error:', pdfError)
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to generate PDF',
          details: pdfError.message
        })
      }
    }

    if (req.method === 'POST') {
      // Report export (previously /api/export-reports)
      if (req.body && req.body.type && req.body.format && req.body.data) {
        return await handleReportExport(req, res)
      }

      const { marksheetId, returnType = 'base64' } = req.body

      if (!marksheetId) {
        return res.status(400).json({ success: false, error: 'marksheetId is required' })
      }

      const marksheetRaw = await Marksheet.findById(marksheetId).populate('staffId').populate('hodId')
      const marksheet = marksheetRaw ? applyResultNormalization(marksheetRaw) : null
      if (!marksheet) {
        return res.status(404).json({ success: false, error: 'Marksheet not found' })
      }

      const staffData = marksheet.staffId
      const staffSignature = (marksheet.staffSignature && marksheet.staffSignature.length > 0)
        ? marksheet.staffSignature
        : (staffData?.eSignature || null)
      const staffName = marksheet.staffName || staffData?.name || 'Staff Name'
      const hodData = marksheet.hodId
      const hodSignature = (marksheet.hodSignature && marksheet.hodSignature.length > 0)
        ? marksheet.hodSignature
        : (hodData?.eSignature || null)
      const hodName = marksheet.hodName || hodData?.name || 'HOD Name'
      const principalSignature = process.env.PRINCIPAL_SIGNATURE_URL || null

      try {
        const pdfBuffer = await generateMarksheetPDF(marksheet, staffSignature, hodSignature, staffName, hodName)

        if (returnType === 'base64') {
          const base64Pdf = pdfBuffer.toString('base64')
          return res.status(200).json({ 
            success: true, 
            pdfBase64: base64Pdf,
            filename: `marksheet_${marksheet.studentDetails.regNumber}_${marksheet.marksheetId}.pdf`
          })
        } else {
          return res.status(200).json({ 
            success: true, 
            message: 'Use GET method to download PDF directly' 
          })
        }

      } catch (pdfError) {
        console.error('PDF generation error:', pdfError)
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to generate PDF',
          details: pdfError.message
        })
      }
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })

  } catch (err) {
    console.error('Generate PDF API error:', err)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }

  // Global error handler for unexpected errors
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err)
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Internal server error', details: err.message })
    }
  })
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason)
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Internal server error', details: reason })
    }
  })
}

// Allow other modules to invalidate the in-memory PDF cache for a marksheet

export const invalidatePdfCache = (marksheetId) => {
  try {
    const key = getCacheKey(marksheetId)
    if (pdfCache.has(key)) {
      pdfCache.delete(key)
      console.log('[generate-pdf] Invalidated PDF cache for:', marksheetId)
    }
  } catch (e) {
    console.warn('[generate-pdf] Failed to invalidate cache for:', marksheetId, e && e.message)
  }
}
