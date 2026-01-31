import { useState } from 'react'
import apiClient from '../utils/apiClient'
import { getUserFriendlyMessage } from '../utils/apiErrorMessages'

function ImportMarks() {
  const [userData, setUserData] = useState(() => {
    const auth = localStorage.getItem('auth')
    return auth ? JSON.parse(auth) : null
  })
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [result, setResult] = useState(null)
  const [errors, setErrors] = useState([])

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setErrors([])
    setResult(null)
    try {
      const form = new FormData()
      form.append('excelFile', file)
      form.append('staffId', userData.id)
      form.append('examinationDate', new Date().toISOString())
      form.append('department', userData.department)
  form.append('year', userData.year)

      try {
        const data = await apiClient.post('/api/import-excel?action=upload', form)
        if (!data || !data.success) {
          setErrors([data?.error || 'Upload failed'])
        } else {
          setSessionId(data.sessionId)
          setErrors(data.errorMessages || [])
        }
      } catch (err) {
        setErrors([getUserFriendlyMessage(err, 'Unexpected error')])
      }
    } catch (e) {
      setErrors([getUserFriendlyMessage(e, 'Unexpected error')])
    } finally {
      setUploading(false)
    }
  }

  const handleConfirm = async () => {
    if (!sessionId) return
    setUploading(true)
    try {
      try {
        const data = await apiClient.post('/api/import-excel?action=confirm', { sessionId }, { timeout: 120000 })
        if (!data || !data.success) {
          setErrors([data?.error || 'Confirm failed'])
        } else {
          setResult(data)
        }
      } catch (err) {
        setErrors([getUserFriendlyMessage(err, 'Unexpected error')])
      }
    } catch (e) {
      setErrors([getUserFriendlyMessage(e, 'Unexpected error')])
    } finally {
      setUploading(false)
    }
  }

  if (!userData || userData.role !== 'staff') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="glass-card p-8 rounded-3xl text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">Only staff members can import marks.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 mb-4">Import Student Marks</h1>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Upload Excel file with student marks data for {userData.department} Department - Year {userData.year}
            </p>
          </div>
          
          <div className="glass-card p-8 rounded-3xl mb-8">
            
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Drop Excel file here</h3>
              <p className="text-gray-600 mb-6">or click to browse</p>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="hidden" id="excelFile" />
              <label htmlFor="excelFile" className="glass-button px-6 py-3 text-blue-600 rounded-xl font-bold cursor-pointer inline-block">
                {file ? 'Change File' : 'Choose File'}
              </label>
              {file && (
                <div className="mt-4 text-gray-700">Selected: <span className="font-semibold">{file.name}</span></div>
              )}
              <div className="mt-6">
                <button disabled={!file || uploading} onClick={handleUpload} className={`px-6 py-3 rounded-xl font-bold ${(!file || uploading) ? 'bg-gray-300 text-gray-500' : 'glass-button text-blue-600'}`}>
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </div>

            {sessionId && (
              <div className="mt-6 p-4 bg-green-50 rounded-xl text-green-800">
                Temporary session created. Session ID: <span className="font-mono">{sessionId}</span>
                <div className="mt-3">
                  <button onClick={handleConfirm} disabled={uploading} className={`px-5 py-2 rounded-lg font-semibold ${uploading ? 'bg-gray-300 text-gray-500' : 'bg-green-600 text-white'}`}>
                    {uploading ? 'Processing...' : 'Confirm Import'}
                  </button>
                </div>
              </div>
            )}

            {errors && errors.length > 0 && (
              <div className="mt-6 p-4 bg-red-50 rounded-xl text-red-800">
                <div className="font-semibold mb-2">Issues found:</div>
                <ul className="list-disc pl-6 space-y-1">
                  {errors.map((e, idx) => (<li key={idx}>{e}</li>))}
                </ul>
              </div>
            )}

            {result && (
              <div className="mt-6 p-4 bg-blue-50 rounded-xl text-blue-900">
                <div className="font-semibold mb-2">Import Completed</div>
                <div>Created: {result.createdCount}</div>
              </div>
            )}

            <div className="mt-8 p-6 bg-blue-50 rounded-xl">
              <h4 className="text-lg font-semibold text-blue-900 mb-3">Excel Format Requirements:</h4>
              <ul className="text-blue-800 space-y-2">
                <li>• <strong>Name</strong> - Student full name</li>
                <li>• <strong>RegNumber</strong> - Student registration number</li>
                <li>• <strong>Section</strong> - Class section (A, B, etc.)</li>
                <li>• <strong>ParentPhone</strong> - Parent WhatsApp number</li>
                <li>• <strong>Subject Columns</strong> - Each subject with marks (0-100)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ImportMarks
