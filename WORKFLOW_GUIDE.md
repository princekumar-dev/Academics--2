# Complete Marksheet Workflow Documentation

## Overview
This document describes the complete workflow for marksheet management: **Import → Staff Verification → HOD Verification → Dispatch → PDF Generation**

## Workflow Stages

### Stage 1: Import Marksheets
**Who**: Staff Member  
**Status**: `imported`

**Steps**:
1. Staff logs in to the account
2. Navigates to Marksheets page
3. Uploads Excel file with student marks
4. System validates and stores data in database
5. Marksheets appear in "Imported" section

**Requirements**:
- Excel file with proper column headers (Name, RegNumber, Year, Section, ParentPhone, Subject marks)
- Valid student registration numbers
- Numeric marks (0-100) or "AB" for absent

**API Endpoint**: 
```
POST /api/import-excel
Body: { file, selectedExamination }
```

---

### Stage 2: Staff Verification
**Who**: Staff Member (who created the marksheets)  
**Status**: `verified_by_staff`

**Steps**:
1. Staff uploads/draws signature in Settings if not already done
2. Navigates to Marksheets page
3. Reviews the imported marksheet data
4. Clicks "Verify" button on each marksheet
5. System saves staff signature to marksheet
6. Status changes to verified_by_staff

**Requirements**:
- Staff must have uploaded signature in Settings
- Signature stored as base64 image (with white background removed)
- Valid signature data in user profile

**API Endpoint**:
```
POST /api/marksheets/verify
Body: { marksheetId, staffSignature }
Returns: { success: true, marksheet: {...} }
```

**Key Fields Saved**:
- `staffSignature`: Base64 image of staff's signature
- `staffName`: Name of staff member
- `status`: "verified_by_staff"
- `verifiedAt`: Timestamp

---

### Stage 3: HOD Verification
**Who**: Head of Department (HOD)

**Status**: `verified_by_hod`

**Steps**:
1. HOD logs in
2. Views marksheets in "Pending HOD Approval" section
3. Reviews data and staff signatures
4. Clicks "Approve" button for each marksheet
5. System saves HOD signature
6. Status changes to verified_by_hod

**Requirements**:
- HOD must have uploaded signature in Settings
- Signature must be black on white background (white removed during upload)
- Can only verify marksheets already verified by staff

**API Endpoint**:
```
POST /api/marksheets/hod-verify
Body: { marksheetId, hodSignature, hodName }
Returns: { success: true, marksheet: {...} }
```

**Key Fields Saved**:
- `hodSignature`: Base64 image of HOD's signature
- `hodName`: Name of HOD
- `status`: "verified_by_hod"
- `hodVerifiedAt`: Timestamp
- Preserves `staffSignature` from previous stage

---

### Stage 4: Dispatch
**Who**: Staff/Admin  
**Status**: `dispatched`

**Steps**:
1. After HOD approval, marksheets are ready for dispatch
2. Staff/Admin selects marksheets to dispatch
3. Chooses dispatch medium (WhatsApp/Email)
4. Clicks "Dispatch" button
5. System sends marksheet PDF to students

**API Endpoint**:
```
POST /api/marksheets/dispatch
Body: { marksheetIds: [], medium: 'whatsapp' }
Returns: { success: true, dispatchInfo: {...} }
```

**Dispatch Status Tracking**:
- `dispatchStatus.dispatched`: true/false
- `dispatchStatus.dispatchedAt`: Timestamp
- `dispatchStatus.medium`: 'whatsapp' or 'email'
- `dispatchStatus.whatsappError`: Error message if failed

---

### Stage 5: PDF Generation
**Triggered**: During dispatch or on manual PDF request

**What Happens**:
1. System retrieves marksheet with all verified data
2. Includes both staff and HOD signatures
3. Generates professional PDF with:
   - Student information
   - All marks
   - Overall grade/result
   - Staff signature and name
   - HOD signature and name
   - Institution header and footer

**API Endpoint**:
```
GET /api/marksheets/pdf/{marksheetId}
Returns: { success: true, pdfData: base64, filename: "..." }
```

**PDF Contents**:
- Header with institution logo/name
- Student details section
- Marks table grouped by subject
- Overall result section
- Signature area with staff and HOD signatures
- Footer with date and principal details

---

## Data Flow Diagram

```
┌─────────────────┐
│   Import File   │
│   (Staff)       │
└────────┬────────┘
         │
         ▼
   ┌──────────────┐
   │  Status:     │
   │  imported    │
   └────────┬─────┘
         │
         ▼
┌─────────────────────┐
│ Staff Verification  │
│ (Add staff sig)     │
└────────┬────────────┘
         │
         ▼
   ┌──────────────────┐
   │  Status:         │
   │  verified_by_    │
   │  staff           │
   └────────┬─────────┘
         │
         ▼
┌─────────────────────┐
│ HOD Verification    │
│ (Add HOD sig)       │
└────────┬────────────┘
         │
         ▼
   ┌──────────────────┐
   │  Status:         │
   │  verified_by_hod │
   └────────┬─────────┘
         │
         ▼
┌─────────────────────┐
│ Dispatch to Students│
│ (PDF generation)    │
└────────┬────────────┘
         │
         ▼
   ┌──────────────────┐
   │  Status:         │
   │  dispatched      │
   └──────────────────┘
```

---

## Signature Processing

### Upload Process
1. **File Input**: User selects image file (PNG, JPEG, WebP)
2. **Validation**: Check file size (max 2MB) and type
3. **White Background Removal**:
   - Convert to canvas for pixel manipulation
   - Identify light pixels (RGB > 230)
   - Make light pixels transparent
   - Convert signature pixels to pure black (0,0,0)
4. **Bounding Box**: Find min/max coordinates of signature
5. **Crop**: Remove excess whitespace (15px padding)
6. **Optimize**: Resize to max 400x100px maintaining aspect ratio
7. **Save**: Store as base64 PNG (optimized quality)

### White Background Removal
```javascript
// Pixels are converted to:
if (brightness >= 230) {
  // Transparent (alpha = 0)
  data[i + 3] = 0
} else {
  // Pure black (0,0,0) with full opacity
  data[i] = 0
  data[i + 1] = 0
  data[i + 2] = 0
  data[i + 3] = 255
}
```

### Result
- Only signature pixels remain (black on transparent)
- Clean appearance in PDFs
- Optimal file size
- Professional look

---

## API Response Format

### All Marksheet Endpoints Return:
```json
{
  "success": true|false,
  "marksheet": {
    "_id": "ObjectId",
    "studentId": "ObjectId",
    "status": "imported|verified_by_staff|verified_by_hod|dispatched",
    "examinationName": "Midterm Exams 2024",
    "studentDetails": {
      "name": "John Doe",
      "regNumber": "21CSE001",
      "department": "Computer Science",
      "year": "II",
      "section": "B"
    },
    "marks": { "Math": 85, "Physics": 92, ... },
    "staffSignature": "data:image/png;base64,...",
    "staffName": "Dr. Smith",
    "hodSignature": "data:image/png;base64,...",
    "hodName": "Prof. Johnson",
    "createdAt": "2024-03-20T10:15:00Z",
    "updatedAt": "2024-03-20T10:15:00Z"
  },
  "error": "Error message if failed"
}
```

---

## Common Issues & Solutions

### Issue: Signature Won't Upload
**Cause**: File too large or invalid format
**Solution**: 
- Use PNG or JPEG format
- Keep file size under 2MB
- Ensure signature is clearly visible (not too light)

### Issue: White Background Not Removed
**Cause**: Signature is too light or background isn't pure white
**Solution**:
- Use pen/marker with dark ink
- Scan on white paper
- Ensure image contrast is clear
- Try different source image

### Issue: Staff Can't Verify
**Cause**: No signature uploaded or marksheet already verified
**Solution**:
- Upload signature in Settings first
- Check that marksheet status is "imported"
- Verify staff ID matches marksheet creator

### Issue: HOD Can't Verify
**Cause**: Marksheet not verified by staff yet
**Solution**:
- Wait for staff verification first
- Check marksheet status should be "verified_by_staff"
- Ensure HOD account has proper department assignment

### Issue: PDF Generation Failed
**Cause**: Missing signatures or corrupted data
**Solution**:
- Ensure both staff and HOD have verified
- Check that signatures are valid base64 images
- View marksheet data before requesting PDF

---

## Testing the Workflow

### Manual Testing Steps:

1. **Import Test**:
   - Upload test Excel file with at least 5 students
   - Verify all marks are visible
   - Check status shows "Imported"

2. **Staff Verification Test**:
   - Go to Settings → Upload Signature
   - Draw or upload black signature
   - Return to Marksheets → Click Verify
   - Confirm status changes to "verified_by_staff"

3. **HOD Verification Test**:
   - Log in as HOD
   - Go to Settings → Upload Signature
   - View pending marksheets
   - Click Approve on first marksheet
   - Confirm status changes to "verified_by_hod"

4. **Dispatch Test**:
   - Select dispatch marksheets
   - Choose WhatsApp or Email
   - Click Dispatch
   - Monitor dispatch status in real-time

5. **PDF Download Test**:
   - View a dispatched marksheet
   - Click Download PDF
   - Verify signatures are visible
   - Check student data is correct

---

## Status Summary

```
✅ Import: Complete - files validated and stored
✅ Staff Verify: Complete - signature processing improved
✅ HOD Verify: Complete - HOD workflow implemented
✅ Dispatch: Complete - WhatsApp/Email dispatch working
✅ PDF: Complete - optimized with signatures
✅ Signature: Enhanced - white background removal improved
```

## Deployment Checklist

- [ ] All test steps pass
- [ ] Signatures are black on white (processed correctly)
- [ ] PDFs display signatures properly
- [ ] Database indexes created
- [ ] Error messages are helpful
- [ ] WhatsApp integration working
- [ ] Email fallback configured
- [ ] Rollback plan ready
