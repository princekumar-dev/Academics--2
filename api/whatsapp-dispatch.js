import { connectToDatabase } from '../lib/mongo.js'
import { Marksheet, User } from '../models.js'
import { getUserSubscriptions, storeNotification } from '../lib/notificationService.js'
import webpush from 'web-push'
import { applyResultNormalization } from './utils/resultUtils.js'
import { sendBroadcastNotification } from '../lib/broadcastNotification.js'
import { evolutionApi } from '../lib/evolutionApiService.js'
import QRCode from 'qrcode'

// Temporary in-memory store for the last Evolution error (for debugging)
let lastEvolutionError = null

// Configure web-push if VAPID keys are available
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:academics@msec.edu',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

// Helper to send notifications to user
async function sendUserNotification(userEmail, title, body, url) {
  try {
    const { subscriptions } = await getUserSubscriptions(userEmail)
    const payload = JSON.stringify({ title, body, url })

    const activeSubs = (subscriptions || []).filter(s => s.active === true || s.status === 'active')
    if (activeSubs.length > 0) {
      await Promise.all(activeSubs.map(sub => 
        webpush.sendNotification(sub.subscription || sub, payload).catch(() => {})
      ))
    }

    // Store notification record
    await storeNotification({ userEmail, title, body, url })
  } catch (err) {
    console.error('Notification error:', err.message)
  }
}

// Helper to build a public base URL for media
const getBaseUrl = (req) => {
  const envBase = process.env.PUBLIC_BASE_URL
  if (envBase) return envBase.replace(/\/$/, '')
  const proto = (req.headers['x-forwarded-proto'] || '').split(',')[0] || req.protocol || 'http'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  return host ? `${proto}://${host}` : ''
}

// Check Evolution API configuration on startup
if (evolutionApi.isConfigured()) {
  console.log('✅ Evolution API for WhatsApp is configured and ready')
} else {
  console.warn('⚠️  Evolution API not configured. Set EVOLUTION_API_URL, EVOLUTION_API_KEY, and EVOLUTION_INSTANCE_NAME in .env file')
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  // Health check endpoint
  if (req.method === 'GET' && req.query.action === 'health') {
    const evolutionStatus = evolutionApi.getConfig()
    
    return res.status(200).json({
      success: true,
      provider: 'evolution',
      configured: evolutionStatus.configured,
      instance: evolutionStatus.instanceName,
      baseUrl: evolutionStatus.baseUrl,
      setupGuide: 'See EVOLUTION_API_SETUP.md for configuration instructions'
    })
  }

  // Evolution API QR Code endpoint
  if (req.method === 'GET' && req.query.action === 'qrcode') {
    try {
      console.log('📱 QR Code request received');
      // If already connected, no QR is needed
      try {
        const status = await evolutionApi.getInstanceStatus()
        if (status.success && (status.connected || status.state === 'open')) {
          console.log('✅ Instance already connected, no QR needed');
          return res.status(200).json({
            success: true,
            message: 'Instance already connected. No QR required.',
            state: status.state,
            connected: true
          })
        }
      } catch {}

      // Try to get QR directly
      console.log('🔄 Attempting to fetch QR from Evolution API...');
      const qrResult = await evolutionApi.getQRCode()
      console.log('📊 QR Result from service:', { success: qrResult.success, hasBase64: !!qrResult.base64, hasQrcode: !!qrResult.qrcode, qrcodeLength: qrResult.qrcode?.length || 0 });
      
      if (qrResult.success && (qrResult.base64 || qrResult.qrcode)) {
        let base64 = qrResult.base64;
        const qrcodeText = qrResult.qrcode;

        // If we have a long qrcode string (ASCII QR), generate PNG from it
        if (qrcodeText && qrcodeText.length > 500 && !base64) {
          console.log('🎨 Converting ASCII QR to PNG...');
          try {
            // Extract QR data from ASCII and generate PNG
            // The qrcode text from Evolution is the actual QR content we can use
            const dataUrl = await QRCode.toDataURL(qrcodeText.replace(/[^0-9A-Za-z\-_]/g, ''), {
              width: 512,
              color: { dark: '#000000', light: '#FFFFFF' },
              errorCorrectionLevel: 'H'
            });
            console.log('✅ PNG generated from ASCII QR');
            return res.status(200).json({ success: true, qrcode: qrcodeText, base64: dataUrl });
          } catch (genErr) {
            console.warn('⚠️ Failed to convert ASCII QR, trying raw text:', genErr.message);
            // Fallback: if the above fails, the qrcode is already displayable as ASCII
            return res.status(200).json({ success: true, qrcode: qrcodeText });
          }
        }

        // If base64 is available, normalize it
        if (base64) {
          if (!base64.startsWith('data:image')) {
            base64 = `data:image/png;base64,${base64}`;
          }
          console.log('📤 Returning QR response with base64');
          return res.status(200).json({ success: true, qrcode: qrcodeText || '', base64 });
        }

        // If only qrcode text and it's short, generate PNG from it
        if (qrcodeText && qrcodeText.length <= 500) {
          console.log('🎨 Generating PNG from short QR text...');
          try {
            const dataUrl = await QRCode.toDataURL(qrcodeText, {
              width: 512,
              color: { dark: '#000000', light: '#FFFFFF' }
            });
            console.log('✅ PNG generated successfully');
            return res.status(200).json({ success: true, qrcode: qrcodeText, base64: dataUrl });
          } catch (genErr) {
            console.warn('Failed to generate QR PNG:', genErr.message);
          }
        }

        return res.status(200).json({ success: true, qrcode: qrcodeText, base64 });
      }

      // Fallback: auto-create instance with QR
      console.log('🆕 Instance not found, creating new instance...');
      const createResult = await evolutionApi.createInstance(true);
      console.log('📊 Create Result:', { success: createResult.success, hasQrcode: !!createResult.qrcode, hasBase64: !!createResult.data?.base64, qrcodeLength: createResult.qrcode?.length || createResult.data?.qrcode?.length || 0 });
      
      if (createResult.success && (createResult.qrcode || createResult.data?.qrcode)) {
        const qrText = createResult.qrcode || createResult.data?.qrcode;
        let base64 = createResult.data?.base64;

        // Handle ASCII QR from create
        if (qrText && qrText.length > 500 && !base64) {
          console.log('🎨 Converting ASCII QR from create to PNG...');
          try {
            const dataUrl = await QRCode.toDataURL(qrText.replace(/[^0-9A-Za-z\-_]/g, ''), {
              width: 512,
              color: { dark: '#000000', light: '#FFFFFF' },
              errorCorrectionLevel: 'H'
            });
            console.log('✅ PNG generated for created instance');
            return res.status(200).json({ success: true, qrcode: qrText, base64: dataUrl, created: true });
          } catch (genErr) {
            console.warn('Failed to convert ASCII QR:', genErr.message);
            return res.status(200).json({ success: true, qrcode: qrText, created: true });
          }
        }

        if (base64 && !base64.startsWith('data:image')) {
          base64 = `data:image/png;base64,${base64}`;
        }

        // If no base64, generate PNG from text
        if (!base64 && qrText && qrText.length <= 500) {
          try {
            base64 = await QRCode.toDataURL(qrText, {
              width: 512,
              color: { dark: '#000000', light: '#FFFFFF' }
            });
            console.log('✅ PNG generated for created instance');
          } catch (genErr) {
            console.warn('Failed to generate QR PNG (create fallback):', genErr.message);
          }
        }

        console.log('📤 Returning created instance QR with base64');
        return res.status(200).json({ success: true, qrcode: qrText, base64, created: true });
      }

      // Final failure: provide clearer guidance
      console.log('❌ Failed to get or create QR');
      return res.status(500).json({
        success: false,
        error: qrResult.error || createResult.error || 'Failed to generate QR',
        hint: 'Verify EVOLUTION_API_URL and EVOLUTION_API_KEY in backend .env and ensure Evolution API is reachable.',
        setupGuide: 'See EVOLUTION_API_SETUP.md'
      });
    } catch (error) {
      console.error('❌ QR endpoint error:', error.message);
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  // Evolution API instance status endpoint
  if (req.method === 'GET' && req.query.action === 'status') {
    try {
      const status = await evolutionApi.getInstanceStatus()
      const config = evolutionApi.getConfig()
      
      // Merge instance status with configuration info
      return res.status(200).json({
        ...status,
        configured: config.configured,
        instance: config.instanceName,
        baseUrl: config.baseUrl,
        provider: config.provider,
        setupGuide: 'See EVOLUTION_API_SETUP.md for configuration instructions'
      })
    } catch (error) {
      const config = evolutionApi.getConfig()
      return res.status(500).json({ 
        success: false, 
        error: error.message,
        configured: config.configured,
        instance: config.instanceName,
        baseUrl: config.baseUrl,
        provider: config.provider
      })
    }
  }

  // Connection status endpoint for UI
  if (req.method === 'GET' && req.query.action === 'connection-status') {
    try {
      const status = await evolutionApi.getInstanceStatus()
      console.log('📊 Instance status from Evolution API:', status);
      
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      return res.status(200).json({
        connected: status?.state === 'open' || status?.connected === true,
        state: status?.state || 'disconnected',
        timestamp: new Date().toISOString(),
        provider: 'evolution',
        configured: evolutionApi.isConfigured(),
        ownerJid: status?.ownerJid
      })
    } catch (error) {
      console.error('❌ Connection status error:', error.message);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return res.status(200).json({
        connected: false,
        state: 'error',
        timestamp: new Date().toISOString(),
        provider: 'evolution',
        configured: evolutionApi.isConfigured(),
        error: error.message
      })
    }
  }

  // Return the last Evolution error (debugging only)
  if (req.method === 'GET' && req.query.action === 'last-evolution-error') {
    return res.status(200).json({ success: true, lastEvolutionError })
  }

  // Create/Initialize Evolution API instance
  if (req.method === 'POST' && req.query.action === 'create-instance') {
    try {
      const result = await evolutionApi.createInstance(true)
      return res.status(200).json(result)
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      })
    }
  }

  // Logout/disconnect current WhatsApp number
  if (req.method === 'POST' && req.query.action === 'logout') {
    try {
      const result = await evolutionApi.logout()
      return res.status(200).json(result)
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      })
    }
  }

  // Delete instance (complete fresh start)
  if (req.method === 'DELETE' && req.query.action === 'delete-instance') {
    try {
      const result = await evolutionApi.deleteInstance()
      return res.status(200).json(result)
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      })
    }
  }

  // Restart instance
  if (req.method === 'POST' && req.query.action === 'restart') {
    try {
      const result = await evolutionApi.restartInstance()
      return res.status(200).json(result)
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      })
    }
  }

  try {
    await connectToDatabase()
  } catch (dbErr) {
    console.error('DB connect error in whatsapp-dispatch API:', dbErr.message)
    return res.status(503).json({ success: false, error: 'Database connection failed' })
  }

  try {
    if (req.method === 'POST') {
      const { action } = req.query

      if (action === 'send-marksheet') {
        const { marksheetId, marksheetPdfUrl, marksheetImageUrl } = req.body

        if (!marksheetId || !marksheetPdfUrl) {
          return res.status(400).json({ 
            success: false, 
            error: 'marksheetId and marksheetPdfUrl are required' 
          })
        }

        // Check if Evolution API is configured
        if (!evolutionApi.isConfigured()) {
          console.error('❌ Evolution API not configured.')
          console.error('Configuration error: Set EVOLUTION_API_URL, EVOLUTION_API_KEY, and EVOLUTION_INSTANCE_NAME in .env file')
          
          return res.status(500).json({ 
            success: false, 
            error: 'WhatsApp service not configured properly',
            details: 'Evolution API not configured. Set EVOLUTION_API_URL, EVOLUTION_API_KEY, and EVOLUTION_INSTANCE_NAME in .env file',
            setupGuide: 'See EVOLUTION_API_SETUP.md for Evolution API setup instructions'
          })
        }

        const marksheet = await Marksheet.findById(marksheetId)
        if (!marksheet) {
          return res.status(404).json({ success: false, error: 'Marksheet not found' })
        }

        const normalizedMarksheet = applyResultNormalization(marksheet.toObject ? marksheet.toObject() : { ...marksheet })

        // Allow dispatch if approved, rescheduled by HOD, or already dispatched (for re-sending)
        const allowedStatuses = ['approved_by_hod', 'rescheduled_by_hod', 'dispatched']
        if (!allowedStatuses.includes(marksheet.status)) {
          return res.status(400).json({ 
            success: false, 
            error: 'Marksheet must be approved by HOD before dispatch' 
          })
        }

        // Helper to build absolute URLs
        const baseUrl = getBaseUrl(req)
        const absoluteUrl = (url) => {
          if (!url) return ''
          try {
            const parsed = new URL(url)
            // Allow localhost/127.* URLs in development
            if (process.env.NODE_ENV === 'production' && (parsed.hostname.includes('localhost') || parsed.hostname.startsWith('127.'))) return ''
            return url
          } catch {
            if (!baseUrl) return ''
            const withSlash = url.startsWith('/') ? url : `/${url}`
            const full = `${baseUrl}${withSlash}`
            try {
              const parsed = new URL(full)
              if (process.env.NODE_ENV === 'production' && (parsed.hostname.includes('localhost') || parsed.hostname.startsWith('127.'))) return ''
              return full
            } catch {
              return ''
            }
          }
        }

        try {
          // Format phone number for WhatsApp (must include country code)
          let parentNumber = normalizedMarksheet.studentDetails.parentPhoneNumber
          
          if (!parentNumber) {
            return res.status(400).json({ success: false, error: 'No valid parent WhatsApp number found' })
          }

          // Extract examination month and year
          const examMonth = new Date(normalizedMarksheet.examinationDate).toLocaleDateString('en-US', { month: 'long' })
          const examYear = new Date(normalizedMarksheet.examinationDate).getFullYear()

          const pdfUrl = absoluteUrl(marksheetPdfUrl)
          const imageUrl = absoluteUrl(marksheetImageUrl)

          // Debug PDF URL
          console.log('📄 PDF URL (resolved):', pdfUrl || marksheetPdfUrl)
          // If the resolved PDF URL is empty or points to localhost, the Evolution API
          // (remote service) will not be able to fetch it. Instead of failing the
          // request, fall back to sending a text-only message so recipients still
          // receive notification. Log a warning and include a `warning` field in
          // the response to inform the sender.
          const localHostPattern = /(^https?:\/\/localhost[:\/])|(^https?:\/\/127\.)|(^localhost[:\/])|(^127\.)/i
          let pdfAccessible = true
          if (!pdfUrl || localHostPattern.test(pdfUrl) || localHostPattern.test(marksheetPdfUrl)) {
            console.warn('⚠️ PDF URL is not publicly accessible. Falling back to text-only message.')
            pdfAccessible = false
          }
          console.log('📱 Using Evolution API for WhatsApp')
          console.log('📞 Sending to:', parentNumber)

          // Send via Evolution API
          const sendResult = await evolutionApi.sendMarksheetNotification({
            studentName: normalizedMarksheet.studentDetails.name,
            registerNumber: normalizedMarksheet.studentDetails.regNumber,
            parentPhoneNumber: parentNumber,
            examName: normalizedMarksheet.examinationName || 'Semester Examination',
            examMonth: examMonth,
            examYear: examYear,
            overallResult: normalizedMarksheet.overallResult || 'Pending',
            pdfUrl: pdfAccessible ? (pdfUrl || marksheetPdfUrl) : '',
            imageUrl: imageUrl
          })

          console.log('✅ Message sent via Evolution API:', sendResult.messageId)

          // Update marksheet dispatch status
          await Marksheet.findByIdAndUpdate(marksheetId, {
            status: 'dispatched',
            'dispatchStatus.dispatched': true,
            'dispatchStatus.dispatchedAt': new Date(),
            'dispatchStatus.whatsappStatus': 'sent',
            updatedAt: new Date()
          })

          // Notify staff about successful dispatch
          try {
            const staff = await User.findById(marksheet.staffId)
            if (staff?.email) {
              await sendUserNotification(
                staff.email,
                '✅ Marksheet Dispatched',
                `Marksheet for ${marksheet.studentDetails.name} (${marksheet.studentDetails.regNumber}) has been successfully sent via WhatsApp to parent and student.`,
                `/marksheets/${marksheet._id}`
              )
            }
          } catch {}

          // Send broadcast notification for marksheet dispatch
          await sendBroadcastNotification(
            '📨 Marksheet Dispatched',
            `Marksheet for ${marksheet.studentDetails.name} has been dispatched via WhatsApp`,
            {
              type: 'marksheet_dispatch',
              marksheetId: marksheet._id.toString(),
              studentName: marksheet.studentDetails.name
            }
          )

          const resp = { success: true, message: 'Marksheet sent successfully via WhatsApp', messageId: sendResult.messageId }
          if (!pdfAccessible) {
            resp.warning = 'PDF URL was not publicly accessible; sent text-only notification instead.'
          }
          return res.status(200).json(resp)

        } catch (evolutionErr) {
          console.error('❌ Evolution API WhatsApp error:', evolutionErr)
          console.error('Error code:', evolutionErr.code)
          console.error('Error status:', evolutionErr.status || evolutionErr.response?.status)
          console.error('Error message:', evolutionErr.message)
          console.error('More info:', evolutionErr.moreInfo)
          if (evolutionErr.response) {
            console.error('Evolution response data:', evolutionErr.response.data)
            console.error('Evolution response headers:', evolutionErr.response.headers)
          }

          // Check for common Evolution API errors
          let errorMessage = evolutionErr.message || 'Evolution API error'
          if (evolutionErr.code === 401 || evolutionErr.message?.toLowerCase().includes('authenticate')) {
            errorMessage = 'Evolution API authentication failed. Please verify your EVOLUTION_API_KEY and related config in .env file.'
          } else if (evolutionErr.code === 400 && evolutionErr.message?.toLowerCase().includes('phone')) {
            errorMessage = 'Invalid phone number format. Phone number must include country code (e.g., +91XXXXXXXXXX)'
          } else if (evolutionErr.code === 403 && evolutionErr.message?.toLowerCase().includes('sandbox')) {
            errorMessage = 'Evolution API WhatsApp Sandbox not configured or not allowed. Please check your Evolution API account.'
          }

          // Update marksheet with error status
          await Marksheet.findByIdAndUpdate(marksheetId, {
            'dispatchStatus.whatsappStatus': 'failed',
            'dispatchStatus.whatsappError': errorMessage,
            updatedAt: new Date()
          })

          // Notify staff about dispatch failure
          try {
            const staff = await User.findById(marksheet.staffId)
            if (staff?.email) {
              await sendUserNotification(
                staff.email,
                '❌ Dispatch Failed',
                `Failed to send marksheet for ${marksheet.studentDetails.name} (${marksheet.studentDetails.regNumber}): ${errorMessage}`,
                `/marksheets/${marksheet._id}`
              )
            }
          } catch {}

          // Prepare evolution response payload for debugging (if available)
          const evolutionResponse = evolutionErr.response?.data ?? null
          const evolutionStatus = evolutionErr.response?.status ?? null
          const evolutionHeaders = evolutionErr.response?.headers ?? null

          // Store last error in-memory for remote debugging via endpoint
          try {
            lastEvolutionError = {
              timestamp: new Date().toISOString(),
              errorMessage,
              details: evolutionErr.message,
              evolutionCode: evolutionErr.code ?? null,
              evolutionStatus,
              evolutionResponse,
              evolutionHeaders
            }
          } catch (storeErr) {
            console.error('Failed to set lastEvolutionError:', storeErr?.message || storeErr)
          }

          return res.status(500).json({ 
            success: false, 
            error: errorMessage,
            details: evolutionErr.message,
            evolutionCode: evolutionErr.code ?? null,
            evolutionStatus,
            evolutionResponse,
            evolutionHeaders
          })
        }
      }

      if (action === 'send-bulk') {
        const { marksheetIds, baseUrl } = req.body

        if (!marksheetIds || !Array.isArray(marksheetIds) || marksheetIds.length === 0) {
          return res.status(400).json({ 
            success: false, 
            error: 'marksheetIds array is required' 
          })
        }

        if (!evolutionApi.isConfigured()) {
          return res.status(500).json({ 
            success: false, 
            error: 'Evolution WhatsApp API not configured' 
          })
        }

        const results = {
          successful: 0,
          failed: 0,
          errors: []
        }

        for (const marksheetId of marksheetIds) {
          try {
            const marksheet = await Marksheet.findById(marksheetId)
            if (!marksheet) {
              results.failed++
              results.errors.push(`Marksheet ${marksheetId} not found`)
              continue
            }

            const normalizedMarksheet = applyResultNormalization(marksheet.toObject ? marksheet.toObject() : { ...marksheet })

            // Allow dispatch if approved, rescheduled by HOD, or already dispatched (for re-sending)
            const allowedStatuses = ['approved_by_hod', 'rescheduled_by_hod', 'dispatched']
            if (!allowedStatuses.includes(marksheet.status)) {
              results.failed++
              results.errors.push(`Marksheet ${marksheetId} not approved by HOD`)
              continue
            }

            // Generate PDF URL for this marksheet
            const marksheetPdfUrl = `${baseUrl}/api/generate-pdf?marksheetId=${marksheetId}`
            const marksheetImageUrl = `${baseUrl}/api/generate-pdf?marksheetId=${marksheetId}&format=jpeg`
            const localHostPattern = /(^https?:\/\/localhost[:\/])|(^https?:\/\/127\.)|(^localhost[:\/])|(^127\.)/i
            let pdfAccessible = true
            if (!baseUrl || localHostPattern.test(baseUrl) || localHostPattern.test(marksheetPdfUrl)) {
              console.warn(`⚠️ Bulk send: PDF URL for ${marksheetId} is not publicly accessible. Falling back to text-only.`)
              pdfAccessible = false
            }

            // Format phone number using normalized function
            let parentNumber = normalizedMarksheet.studentDetails.parentPhoneNumber
            const normalizeToWhatsApp = (num) => {
              if (!num) return null
              let n = num.replace(/[^0-9+]/g, '')
              if (!n.startsWith('+')) {
                n = n.startsWith('91') ? `+${n}` : `+91${n}`
              }
              return n
            }
            const phoneNumber = normalizeToWhatsApp(parentNumber)
            
            if (!phoneNumber) {
              results.failed++
              results.errors.push(`No valid parent phone number for marksheet ${marksheetId}`)
              continue
            }

            // Extract examination month and year
            const examMonth = new Date(normalizedMarksheet.examinationDate).toLocaleDateString('en-US', { month: 'long' })
            const examYear = new Date(normalizedMarksheet.examinationDate).getFullYear()

            const message = `Hello! 📚

Your child's marksheet for ${normalizedMarksheet.studentDetails.name} (Reg: ${normalizedMarksheet.studentDetails.regNumber}) is ready.

🎓 Year/Sem: ${normalizedMarksheet.studentDetails.year}/${normalizedMarksheet.semester || '—'}
📅 Examination: ${examMonth} ${examYear}
📊 Overall Result: ${normalizedMarksheet.overallResult || '—'}

Please find the detailed marksheet attached.

Best regards,
MSEC Academics Department`


            // Use Evolution API to send marksheet notification
            try {
              await evolutionApi.sendMarksheetNotification({
                studentName: normalizedMarksheet.studentDetails.name,
                registerNumber: normalizedMarksheet.studentDetails.regNumber,
                parentPhoneNumber: phoneNumber,
                examName: normalizedMarksheet.examinationName || 'Examination',
                examMonth,
                examYear,
                overallResult: normalizedMarksheet.overallResult || '—',
                pdfUrl: pdfAccessible ? marksheetPdfUrl : ''
              });
            } catch (evoErr) {
              throw new Error(`Evolution API error: ${evoErr.message}`);
            }

            // Update marksheet status
            await Marksheet.findByIdAndUpdate(marksheetId, {
              status: 'dispatched',
              'dispatchStatus.dispatched': true,
              'dispatchStatus.dispatchedAt': new Date(),
              'dispatchStatus.whatsappStatus': 'sent',
              updatedAt: new Date()
            })

            results.successful++

          } catch (err) {
            console.error(`Error sending marksheet ${marksheetId}:`, err)
            results.failed++
            results.errors.push(`Failed to send marksheet ${marksheetId}: ${err.message}`)

            // Update marksheet with error status
            await Marksheet.findByIdAndUpdate(marksheetId, {
              'dispatchStatus.whatsappStatus': 'failed',
              'dispatchStatus.whatsappError': err.message,
              updatedAt: new Date()
            })
          }

          // Add small delay between messages to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000))
        }

        // Notify staff about bulk dispatch completion
        try {
          if (marksheetIds.length > 0) {
            const firstMarksheet = await Marksheet.findById(marksheetIds[0]).populate('staffId', 'email name')
            if (firstMarksheet?.staffId?.email) {
              const successRate = ((results.successful / marksheetIds.length) * 100).toFixed(0)
              await sendUserNotification(
                firstMarksheet.staffId.email,
                '📦 Bulk Dispatch Complete',
                `Dispatched ${results.successful} of ${marksheetIds.length} marksheets (${successRate}% success rate). ${results.failed > 0 ? `${results.failed} failed.` : ''}`,
                '/dispatch-requests'
              )
            }
          }
        } catch {}

        return res.status(200).json({ 
          success: true, 
          message: 'Bulk dispatch completed',
          results
        })
      }

      return res.status(400).json({ success: false, error: 'Invalid action' })
    }

    if (req.method === 'GET') {
      // Get dispatch status for marksheets
      const { marksheetIds } = req.query

      if (!marksheetIds) {
        return res.status(400).json({ success: false, error: 'marksheetIds query parameter required' })
      }

      const ids = Array.isArray(marksheetIds) ? marksheetIds : marksheetIds.split(',')
      
      const marksheets = await Marksheet.find(
        { _id: { $in: ids } },
        { 
          _id: 1, 
          marksheetId: 1, 
          studentDetails: 1, 
          status: 1, 
          dispatchStatus: 1 
        }
      )

      return res.status(200).json({ success: true, marksheets })
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })

  } catch (err) {
    console.error('WhatsApp dispatch API error:', err)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
