/**
 * Evolution API Service
 * 
 * Service for sending WhatsApp messages using Evolution API
 * Evolution API is a robust WhatsApp API that supports multiple messaging platforms
 * and provides better reliability than Twilio for WhatsApp Business messages.
 * 
 * Documentation: https://doc.evolution-api.com
 */

import axios from 'axios';

class EvolutionAPIService {
  /**
   * Create a new EvolutionAPIService instance.
   * options: { instanceName, baseUrl, apiKey }
   * If not provided, falls back to environment variables.
   */
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || process.env.EVOLUTION_API_URL;
    this.apiKey = options.apiKey || process.env.EVOLUTION_API_KEY;
    this.instanceName = options.instanceName || process.env.EVOLUTION_INSTANCE_NAME || 'msec_academics';
    this.configured = !!(this.baseUrl && this.apiKey);

    if (!this.configured) {
      console.warn('⚠️ Evolution API not configured. Set EVOLUTION_API_URL, EVOLUTION_API_KEY, and EVOLUTION_INSTANCE_NAME');
    } else {
      console.log('✅ Evolution API initialized successfully');
      console.log(`   Instance: ${this.instanceName}`);
      console.log(`   Base URL: ${this.baseUrl}`);
      console.log(`   API Key: ${this.apiKey ? this.apiKey.substring(0, 8) + '...' : 'NOT SET'}`);
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.apiKey,
        'Authorization': `Bearer ${this.apiKey}`,
        'api-key': this.apiKey
      },
      timeout: 90000 // 90 second timeout for media-heavy operations
    });
  }

  /**
   * Check if Evolution API is configured
   */
  isConfigured() {
    return this.configured;
  }

  /**
   * Get instance connection status
   */
  async getInstanceStatus() {
    if (!this.configured) {
      return {
        success: false,
        error: 'Evolution API not configured',
        connected: false,
        state: 'not_configured'
      };
    }

    // Try multiple times to tolerate transient provider errors (e.g., after wake/restart)
    const attempts = 3;
    const delay = (ms) => new Promise(r => setTimeout(r, ms));

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        // Try to fetch instance info first (specific fetch)
        const response = await this.client.get(`/instance/fetchInstances?instanceName=${this.instanceName}`);
        console.log('Evolution API instance fetch response:', { attempt, dataKeys: Object.keys(response.data || {}), dataPreview: Array.isArray(response.data) ? `array(${response.data.length})` : typeof response.data });

        const instances = response.data;
        const instance = Array.isArray(instances)
          ? instances.find(i => (i && (i.name === this.instanceName || i.instance?.instanceName === this.instanceName)))
          : (instances && (instances.name === this.instanceName || instances.instance?.instanceName === this.instanceName) ? instances : null);

        if (instance) {
          const state = instance.connectionStatus || instance.instance?.state || instance.state || 'unknown';
          console.log('Found instance via fetchInstances:', { attempt, state, ownerJid: instance.ownerJid });
          return { success: true, connected: state === 'open', state, instance: this.instanceName, ownerJid: instance.ownerJid };
        }

        // If not found, try connectionState endpoint as fallback
        const stateResponse = await this.client.get(`/instance/connectionState/${this.instanceName}`);
        console.log('Evolution API connectionState response:', { attempt, data: stateResponse.data });
        const responseState = stateResponse.data.instance?.state || stateResponse.data.state || 'unknown';
        return { success: true, connected: responseState === 'open', state: responseState, instance: this.instanceName };

      } catch (error) {
        // Log full diagnostics for each attempt
        console.error(`Evolution API status check failed (attempt ${attempt}):`, error.message || error);
        if (error.response) {
          console.error('Response status:', error.response.status);
          console.error('Response data keys:', Object.keys(error.response.data || {}));
          console.error('Response data (preview):', JSON.stringify(error.response.data).slice(0, 1000));
        }

        // If 404 on a specific attempt, try a full list fetch to attempt to locate the instance under unexpected fields
        if (error.response?.status === 404) {
          try {
            const listResp = await this.client.get('/instance/fetchInstances');
            console.log('Fetched all instances as fallback (for diagnostics):', { count: Array.isArray(listResp.data) ? listResp.data.length : 'unknown', keys: Object.keys(listResp.data || {}) });
            const all = listResp.data || [];
            const found = Array.isArray(all) ? all.find(i => i && (i.name === this.instanceName || i.instance?.instanceName === this.instanceName)) : null;
            if (found) {
              const state = found.connectionStatus || found.instance?.state || found.state || 'unknown';
              console.warn('Instance found in full list despite earlier 404:', { state });
              return { success: true, connected: state === 'open', state, instance: this.instanceName, ownerJid: found.ownerJid };
            }
          } catch (listErr) {
            console.warn('Failed to fetch full instance list as fallback:', listErr.message || listErr);
          }

          // If this was the last attempt, return not_found explicitly
          if (attempt === attempts) {
            return { success: false, error: `Instance "${this.instanceName}" not found. Please create it first.`, connected: false, state: 'not_found' };
          }
        }

        // If 401 authentication error, return immediately with clear message
        if (error.response?.status === 401) {
          return { success: false, error: 'Authentication failed with Evolution API (401). Verify EVOLUTION_API_KEY.', connected: false, state: 'auth_error' };
        }

        // Otherwise wait a bit and retry (exponential backoff)
        await delay(250 * Math.pow(2, attempt - 1));
        continue;
      }
    }

    // Shouldn't reach here, but return a generic error state
    return { success: false, error: 'Unknown Evolution API status error', connected: false, state: 'error' };
  }

  /**
   * Create or connect to an instance
   */
  async createInstance(qrcode = true) {
    try {
      const response = await this.client.post('/instance/create', {
        instanceName: this.instanceName,
        qrcode: qrcode,
        integration: 'WHATSAPP-BAILEYS'
      });

      return {
        success: true,
        data: response.data,
        qrcode: response.data.qrcode
      };
    } catch (error) {
      console.error('Failed to create instance:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get QR code for WhatsApp connection
   */
  async getQRCode() {
    try {
      console.log(`🔄 Fetching QR from Evolution API endpoint: /instance/connect/${this.instanceName}`);
      const response = await this.client.get(`/instance/connect/${this.instanceName}`);
      console.log('📥 Raw response from Evolution API:', { 
        status: response.status, 
        keys: Object.keys(response.data || {}),
        hasQrcode: !!response.data?.qrcode,
        hasBase64: !!response.data?.base64,
        hasBase64Qr: !!response.data?.base64Qr,
        hasImage: !!response.data?.image
      });
      
      const data = response.data || {};
      // Normalize possible field names from Evolution API
      let base64 = data.base64 || data.base64Qr || data.base64Image || data?.image?.base64 || data?.qr?.base64 || null;
      let qrcode = data.qrcode || data.qrCode || data.qr || data.code || data?.code?.text || null;
      
      // If qrcode is a long ASCII string (QR as ASCII art), keep it for PNG generation
      // If it's already base64, that's our image
      if (qrcode && qrcode.length > 500 && !base64) {
        console.log('🎨 Detected ASCII QR code from Evolution API, will generate PNG');
        // Don't use ASCII QR directly - we'll generate PNG from it in the endpoint
      }
      
      console.log('✅ Normalized QR data:', { base64Length: base64?.length || 0, qrcodeLength: qrcode?.length || 0, hasQrcode: !!qrcode });
      
      return {
        success: true,
        qrcode,
        base64
      };
    } catch (error) {
      console.error('Failed to get QR code:', error.message);
      const status = error.response?.status;
      const errMsg = error.response?.data?.message || error.message;
      console.error('QR fetch error details:', { status, errMsg, keys: Object.keys(error.response?.data || {}) });
      // If the instance doesn't exist yet, create it and return the QR from creation
      if (status === 404 || /not found/i.test(errMsg)) {
        try {
          const created = await this.createInstance(true);
          if (created.success) {
            return {
              success: true,
              qrcode: created.qrcode || created.data?.qrcode,
              base64: created.data?.base64
            };
          }
        } catch (createErr) {
          console.error('Failed to create instance for QR:', createErr.message);
        }
      }

      // Provide clearer message for authentication errors
      if (status === 401) {
        return {
          success: false,
          error: 'Authentication failed. Please verify EVOLUTION_API_KEY in backend .env'
        };
      }

      return {
        success: false,
        error: errMsg
      };
    }
  }

  /**
   * Logout/disconnect the current WhatsApp connection
   * This allows connecting a different number
   */
  async logout() {
    try {
      const response = await this.client.delete(`/instance/logout/${this.instanceName}`);
      return {
        success: true,
        message: 'WhatsApp disconnected successfully. You can now scan QR code with a different number.',
        data: response.data
      };
    } catch (error) {
      console.error('Failed to logout:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete the instance completely (removes all session data)
   * Use this for a fresh start
   */
  async deleteInstance() {
    if (!this.configured) {
      return {
        success: false,
        error: 'Evolution API not configured'
      };
    }

    try {
      console.log('[Evolution] Attempting to delete instance:', this.instanceName);

      // Always try logout first so the device session is explicitly disconnected.
      try {
        console.log('[Evolution] Attempting device logout before delete...');
        const logoutResult = await this.logout();
        if (logoutResult?.success) {
          console.log('[Evolution] Device logout succeeded');
        } else {
          console.log('[Evolution] Device logout returned unsuccessful response:', logoutResult?.error || logoutResult);
        }
      } catch (logoutErr) {
        console.log('[Evolution] Device logout failed, continuing to delete:', logoutErr.message);
      }

      // Then try force delete so the instance/session data is removed quickly.
      try {
        console.log('[Evolution] Attempting fast force delete...');
        const response = await this.client.delete(`/instance/delete/${this.instanceName}?force=true`, {
          timeout: 12000
        });
        console.log('[Evolution] Fast force delete succeeded');
        return {
          success: true,
          message: 'Instance deleted immediately (force delete).',
          data: response.data
        };
      } catch (forceErr) {
        console.log('[Evolution] Fast force delete failed, trying fallback flow:', forceErr.message);
      }

      try {
        console.log('[Evolution] Attempting regular delete...');
        const response = await this.client.delete(`/instance/delete/${this.instanceName}`, {
          timeout: 12000
        });
        console.log('[Evolution] Regular delete succeeded');
        return {
          success: true,
          message: 'Instance deleted successfully. Create a new instance to start fresh.',
          data: response.data
        };
      } catch (regularErr) {
        console.log('[Evolution] Regular delete failed, trying final fallback:', regularErr.message);
      }
    } catch (error) {
      console.error('[Evolution] Failed to delete instance:', error.message);
      if (error.response) {
        console.error('Delete error response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      }

      // Even if deletion fails (e.g., instance doesn't exist), treat as success
      if (error.response?.status === 404) {
        console.log('[Evolution] Instance was already deleted or does not exist (404)');
        return {
          success: true,
          message: 'Instance was already deleted or does not exist.',
          data: null
        };
      }

      // Try alternative deletion endpoint as last resort
      try {
        console.log('[Evolution] Trying alternative delete endpoint...');
        const altResponse = await this.client.delete(/instance/, {
          timeout: 12000
        });
        console.log('[Evolution] Alternative delete succeeded');
        return {
          success: true,
          message: 'Instance deleted via alternative endpoint.',
          data: altResponse.data
        };
      } catch (altErr) {
        console.error('[Evolution] Alternative delete also failed:', altErr.message);
      }

      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Unknown deletion error'
      };
    }
  }
  /**
   * Restart the instance connection
   */
  async restartInstance() {
    try {
      const response = await this.client.put(`/instance/restart/${this.instanceName}`);
      return {
        success: true,
        message: 'Instance restarted successfully',
        data: response.data
      };
    } catch (error) {
      console.error('Failed to restart instance:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Normalize phone number into international digits-only format
   * Accepts values like +91XXXXXXXXXX, 91XXXXXXXXXX, 0XXXXXXXXXX, XXXXXXXXXX
   * @param {string} phoneNumber - Phone number input
   * @param {string} defaultCountryCode - Default country code (India = 91)
   * @returns {string|null} - Normalized digits-only number (e.g., 919876543210)
   */
  normalizePhoneNumber(phoneNumber, defaultCountryCode = '91') {
    if (!phoneNumber) return null;

    let cleaned = String(phoneNumber).trim();
    if (!cleaned) return null;

    // Keep optional plus first, then strip everything else down to digits
    cleaned = cleaned.replace(/[^0-9+]/g, '');
    if (cleaned.startsWith('+')) {
      cleaned = cleaned.slice(1);
    }
    cleaned = cleaned.replace(/\D/g, '');

    // Convert 00-prefixed international notation (e.g., 0091...)
    if (cleaned.startsWith('00')) {
      cleaned = cleaned.slice(2);
    }

    // Remove trunk prefix zeros for local 10-digit entries (e.g., 09876543210)
    cleaned = cleaned.replace(/^0+(?=\d{10}$)/, '');

    // Add default country code for local 10-digit numbers
    if (cleaned.length === 10) {
      cleaned = `${defaultCountryCode}${cleaned}`;
    }

    // If number already contains default country code, drop accidental leading zeros in subscriber part
    if (cleaned.startsWith(defaultCountryCode)) {
      const subscriber = cleaned.slice(defaultCountryCode.length).replace(/^0+/, '');
      cleaned = `${defaultCountryCode}${subscriber}`;
    }

    // Final sanity check for international mobile lengths
    if (cleaned.length < 11 || cleaned.length > 15) {
      return null;
    }

    return cleaned;
  }

  /**
   * Format phone number to WhatsApp format
   * @param {string} phoneNumber - Phone number to format
   * @returns {string} - Formatted phone number (e.g., 919876543210@s.whatsapp.net)
   */
  formatPhoneNumber(phoneNumber) {
    const normalized = this.normalizePhoneNumber(phoneNumber);
    if (!normalized) {
      throw new Error('Invalid phone number format. Use +91XXXXXXXXXX or 10-digit mobile number');
    }

    return `${normalized}@s.whatsapp.net`;
  }

  /**
   * Get WhatsApp-compatible number variants for provider compatibility
   * Some Evolution API versions expect JID format while others expect digits-only
   * @param {string} phoneNumber - Phone number input
   * @returns {string[]} - Ordered unique list of candidate number formats
   */
  getNumberVariants(phoneNumber) {
    const normalized = this.normalizePhoneNumber(phoneNumber);
    if (!normalized) {
      throw new Error('Invalid phone number format. Use +91XXXXXXXXXX or 10-digit mobile number');
    }

    const variants = [
      `${normalized}@s.whatsapp.net`,
      normalized
    ];

    return [...new Set(variants.filter(Boolean))];
  }

  /**
   * Extract best available provider error message from axios error object
   * @param {any} err - Error object
   * @returns {string}
   */
  extractProviderErrorMessage(err) {
    return err?.response?.data?.response?.message
      || err?.response?.data?.message
      || err?.response?.data?.error
      || err?.message
      || 'Unknown provider error';
  }

  /**
   * Send a text message via WhatsApp
   * @param {string} phoneNumber - Recipient phone number
   * @param {string} message - Message text to send
   */
  async sendTextMessage(phoneNumber, message) {
    if (!this.configured) {
      throw new Error('Evolution API not configured');
    }

    try {
      const numberVariants = this.getNumberVariants(phoneNumber);
      const endpoint = `/message/sendText/${this.instanceName}`;

      let lastError = null;

      for (const number of numberVariants) {
        const payloads = [
          { number, text: message, delay: 1000 },
          { number, textMessage: message, delay: 1000 },
          { number, textMessage: { text: message }, delay: 1000 },
          { number, message: { text: message }, delay: 1000 }
        ];

        for (const payload of payloads) {
          try {
            const response = await this.client.post(endpoint, payload, { timeout: 90000 });
            return {
              success: true,
              messageId: response.data.key?.id,
              data: response.data
            };
          } catch (attemptErr) {
            lastError = attemptErr;
          }
        }
      }

      throw lastError || new Error('Unable to send WhatsApp text message');
    } catch (error) {
        console.error('Failed to send text message:', this.extractProviderErrorMessage(error));
        // If Axios provided a response, attach it to a new Error so callers can
        // inspect `err.response` and `err.response.data`. Otherwise rethrow.
        if (error && error.response) {
          const e = new Error(`WhatsApp message failed: ${this.extractProviderErrorMessage(error)}`);
          e.response = error.response;
          e.code = error.response.status;
          throw e;
        }
        throw error;
    }
  }

  /**
   * Send a message with media (image/document)
   * @param {string} phoneNumber - Recipient phone number
   * @param {string} mediaUrl - URL of the media to send
   * @param {string} caption - Caption for the media
   * @param {string} mediaType - Type: 'image' or 'document'
   */
  async sendMediaMessage(phoneNumber, mediaUrl, caption = '', mediaType = 'image', fileName = null) {
    if (!this.configured) {
      throw new Error('Evolution API not configured');
    }

    try {
      const numberVariants = this.getNumberVariants(phoneNumber);
      
      const endpoint = mediaType === 'document' 
        ? `/message/sendMedia/${this.instanceName}`
        : `/message/sendMedia/${this.instanceName}`;

      let lastError = null;
      for (const number of numberVariants) {
        const payload = {
          number,
          mediatype: mediaType === 'document' ? 'document' : 'image',
          media: mediaUrl,
          caption: caption,
          delay: 1000
        };

        if (mediaType === 'document') {
          payload.fileName = fileName || 'marksheet.pdf';
        }

        try {
          const response = await this.client.post(endpoint, payload, { timeout: 120000 });
          return {
            success: true,
            messageId: response.data.key?.id,
            data: response.data
          };
        } catch (attemptErr) {
          lastError = attemptErr;
        }
      }

      throw lastError || new Error('Unable to send WhatsApp media message');
    } catch (error) {
        console.error('Failed to send media message:', this.extractProviderErrorMessage(error));
        if (error && error.response) {
          const e = new Error(`WhatsApp media message failed: ${this.extractProviderErrorMessage(error)}`);
          e.response = error.response;
          e.code = error.response.status;
          throw e;
        }
        throw error;
    }
  }

  /**
   * Send marksheet notification via WhatsApp
   * @param {Object} params - Parameters for sending marksheet
   * @param {string} params.studentName - Name of the student
   * @param {string} params.registerNumber - Student register number
   * @param {string} params.parentPhoneNumber - Parent's phone number
   * @param {string} params.examName - Name of examination
   * @param {string} params.examMonth - Examination month
   * @param {string} params.examYear - Examination year
   * @param {string} params.overallResult - Overall result (Pass/Fail)
   * @param {string} params.pdfUrl - URL to marksheet PDF
   * @param {string} params.imageUrl - URL to marksheet image (optional)
   */
  async sendMarksheetNotification({
    studentName,
    registerNumber,
    parentPhoneNumber,
    examName,
    examMonth,
    examYear,
    overallResult,
    pdfUrl,
    // imageUrl (no longer used)
  }) {
    if (!this.configured) {
      throw new Error('Evolution API not configured');
    }


    try {
      console.log('📤 Sending marksheet notification via WhatsApp...');
      console.log('📞 To:', parentPhoneNumber);
      console.log('📄 PDF URL:', pdfUrl);
      // console.log('🖼️ Image URL:', imageUrl); // No longer used

      // Format the message with the PDF link included
      const message = `🎓 *MSEC Academics - Marksheet Available*

Dear Parent/Guardian,

The marksheet for your ward has been published:

👤 *Student Name:* ${studentName}
🆔 *Register Number:* ${registerNumber}
📅 *Period:* ${examMonth} ${examYear}
📝 *Examination:* ${examName}
📊 *Result:* ${overallResult}

Your ward's marksheet is now available. You can download it from the link below:

📥 *Download PDF*: ${pdfUrl}

For any queries, please contact the academic department.

*Meenakshi Sundararajan Engineering College*
_This is an automated message_`;

      // Send the PDF as a WhatsApp document attachment first, then send the full text message
      if (pdfUrl) {
        try {
          const safeRegisterNumber = (registerNumber || 'unknown')
            .toString()
            .trim()
            .replace(/[^a-zA-Z0-9_-]/g, '_')
          const attachmentFileName = `marksheet-${safeRegisterNumber}.pdf`

          // Send the document with an empty caption to ensure the file appears first
          await this.sendMediaMessage(
            parentPhoneNumber,
            pdfUrl,
            '',
            'document',
            attachmentFileName
          );
          console.log('✅ Marksheet PDF sent successfully (no caption)');
        } catch (pdfError) {
          console.error('❌ Failed to send marksheet PDF:', pdfError.message);
          // Do not throw — proceed to send the text message so recipient still receives notification
        }

        // Small delay to improve ordering across providers
        await new Promise(resolve => setTimeout(resolve, 1200));

        try {
          await this.sendTextMessage(parentPhoneNumber, message);
          console.log('✅ Marksheet notification text sent successfully');
        } catch (txtErr) {
          console.error('❌ Failed to send marksheet text message after PDF:', txtErr.message);
          throw new Error(`Failed to send marksheet notification: ${txtErr.message}`);
        }
      } else {
        // No PDF — just send the text message
        await this.sendTextMessage(parentPhoneNumber, message);
      }

      return {
        success: true,
        phoneNumber: parentPhoneNumber,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Failed to send marksheet notification:', error.message);
      throw error;
    }
  }

  /**
   * Send bulk messages (with rate limiting)
   * @param {Array} messages - Array of message objects with phoneNumber and message
   * @param {number} delayMs - Delay between messages in milliseconds (default: 2000ms)
   */
  async sendBulkMessages(messages, delayMs = 2000) {
    const results = [];
    
    for (const msg of messages) {
      try {
        const result = await this.sendTextMessage(msg.phoneNumber, msg.message);
        results.push({
          phoneNumber: msg.phoneNumber,
          success: true,
          messageId: result.messageId
        });
      } catch (error) {
        results.push({
          phoneNumber: msg.phoneNumber,
          success: false,
          error: error.message
        });
      }
      
      // Add delay between messages to avoid rate limiting
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    return results;
  }

  /**
   * Check if a phone number has WhatsApp
   * @param {string} phoneNumber - Phone number to check
   */
  async checkWhatsAppNumber(phoneNumber) {
    try {
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      
      const response = await this.client.get(`/chat/whatsappNumbers/${this.instanceName}`, {
        params: {
          numbers: [formattedNumber]
        }
      });

      return {
        success: true,
        hasWhatsApp: response.data?.[0]?.exists || false,
        number: formattedNumber
      };
    } catch (error) {
      console.error('Failed to check WhatsApp number:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get configuration status for health checks
   */

  getConfig() {
    return {
      configured: this.configured,
      baseUrl: this.baseUrl ? this.baseUrl.substring(0, 30) + '...' : 'Not set',
      apiKey: this.apiKey ? '****' + this.apiKey.slice(-4) : 'Not set',
      instanceName: this.instanceName,
      provider: 'Evolution API'
    };
  }
}

// Export singleton instance
export const evolutionApi = new EvolutionAPIService();
export default evolutionApi;

/**
 * Return a new EvolutionAPIService for a custom instance name.
 * If `suffix` is an object it can contain { instanceName, baseUrl, apiKey }.
 * If `suffix` is a string (e.g., staffId), it will append it to the base
 * instance name from env as `${EVOLUTION_INSTANCE_NAME}_${suffix}`.
 */
export function getEvolutionApi(suffixOrOptions) {
  if (!suffixOrOptions) return new EvolutionAPIService();

  if (typeof suffixOrOptions === 'string') {
    const base = process.env.EVOLUTION_INSTANCE_NAME || 'msec_academics';
    // sanitize suffix: keep only safe chars
    const safeSuffix = String(suffixOrOptions).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
    const instanceName = `${base}_${safeSuffix}`;
    return new EvolutionAPIService({ instanceName });
  }

  // assume object with explicit options
  return new EvolutionAPIService(suffixOrOptions);
}

/**
 * Convenience factory for staff-scoped instance using staff id or email
 */
export function getEvolutionApiForStaff(staffIdentifier) {
  return getEvolutionApi(String(staffIdentifier || '').replace(/[^a-zA-Z0-9_-]/g, '_'));
}
