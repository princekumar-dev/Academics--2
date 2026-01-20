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
  constructor() {
    this.baseUrl = process.env.EVOLUTION_API_URL;
    this.apiKey = process.env.EVOLUTION_API_KEY;
    this.instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'msec_academics';
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
      timeout: 30000 // 30 second timeout
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

    try {
      // Try to fetch instance info first
      const response = await this.client.get(`/instance/fetchInstances?instanceName=${this.instanceName}`);
      console.log('Evolution API instance fetch response:', response.data);
      
      // Check if instance exists in the response
      const instances = response.data;
      console.log('Is array?', Array.isArray(instances));
      console.log('Instances:', instances);
      
      const instance = Array.isArray(instances) 
        ? instances.find(i => {
            console.log('Checking instance:', { name: i.name, instanceName: this.instanceName, match: i.name === this.instanceName });
            return i.name === this.instanceName || i.instance?.instanceName === this.instanceName;
          })
        : instances;
      
      console.log('Found instance:', instance);
      
      if (instance) {
        // The fetchInstances response uses 'connectionStatus' directly on the instance object
        const state = instance.connectionStatus || instance.instance?.state || instance.state || 'unknown';
        console.log('Extracted state from fetchInstances:', { connectionStatus: instance.connectionStatus, state });
        return {
          success: true,
          connected: state === 'open',
          state: state,
          instance: this.instanceName,
          ownerJid: instance.ownerJid
        };
      }
      
      // If not found in fetch, try connectionState endpoint
      const stateResponse = await this.client.get(`/instance/connectionState/${this.instanceName}`);
      console.log('Evolution API connectionState response:', stateResponse.data);
      
      // The response structure is { instance: { instanceName: '...', state: 'open' } }
      const responseState = stateResponse.data.instance?.state || stateResponse.data.state || 'unknown';
      console.log('Extracted state from connectionState:', responseState);
      
      return {
        success: true,
        connected: responseState === 'open',
        state: responseState,
        instance: this.instanceName
      };
    } catch (error) {
      console.error('Evolution API status check failed:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      
      // If 404, instance doesn't exist
      if (error.response?.status === 404) {
        return {
          success: false,
          error: `Instance "${this.instanceName}" not found. Please create it first.`,
          connected: false,
          state: 'not_found'
        };
      }
      
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        connected: false,
        state: 'error'
      };
    }
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
      console.log(`🗑️ Attempting to delete instance: ${this.instanceName}`);
      
      // Try to force logout/disconnect regardless of state
      try {
        console.log('🔌 Force disconnecting instance...');
        await this.client.delete(`/instance/logout/${this.instanceName}`);
        console.log('✅ Logout successful');
      } catch (logoutErr) {
        console.log('⚠️ Logout attempt failed (continuing with delete):', logoutErr.message);
      }
      
      // Delete with force flag for instances in connecting state
      try {
        console.log('🗑️ Attempting force delete with force=true parameter...');
        const response = await this.client.delete(`/instance/delete/${this.instanceName}?force=true`);
        console.log('✅ Instance force deleted successfully:', response.data);
        return {
          success: true,
          message: 'Instance deleted immediately (force delete).',
          data: response.data
        };
      } catch (forceErr) {
        console.log('⚠️ Force delete endpoint not supported, trying regular delete...');
        
        // Fall back to regular delete
        const response = await this.client.delete(`/instance/delete/${this.instanceName}`);
        console.log('✅ Instance deleted successfully:', response.data);
        return {
          success: true,
          message: 'Instance deleted successfully. Create a new instance to start fresh.',
          data: response.data
        };
      }
    } catch (error) {
      console.error('❌ Failed to delete instance:', error.message);
      if (error.response) {
        console.error('Delete error response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      }
      
      // Even if deletion fails (e.g., instance doesn't exist), treat as success
      if (error.response?.status === 404) {
        console.log('✅ Instance was already deleted or does not exist (404)');
        return {
          success: true,
          message: 'Instance was already deleted or does not exist.',
          data: null
        };
      }
      
      // Try alternative deletion endpoint as last resort
      try {
        console.log('🔄 Trying alternative delete endpoint...');
        const altResponse = await this.client.delete(`/instance/${this.instanceName}`);
        console.log('✅ Alternative delete succeeded');
        return {
          success: true,
          message: 'Instance deleted via alternative endpoint.',
          data: altResponse.data
        };
      } catch (altErr) {
        console.error('❌ Alternative delete also failed:', altErr.message);
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
   * Format phone number to WhatsApp format
   * @param {string} phoneNumber - Phone number to format
   * @returns {string} - Formatted phone number (e.g., 919876543210@s.whatsapp.net)
   */
  formatPhoneNumber(phoneNumber) {
    if (!phoneNumber) return null;
    
    // Remove all non-numeric characters
    let cleaned = phoneNumber.replace(/[^0-9]/g, '');
    
    // Add country code if not present (default to India +91)
    if (!cleaned.startsWith('91') && cleaned.length === 10) {
      cleaned = '91' + cleaned;
    }
    
    // Return in WhatsApp format
    return `${cleaned}@s.whatsapp.net`;
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
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      
      const endpoint = `/message/sendText/${this.instanceName}`;

      // Primary payload (common shape)
      try {
        const response = await this.client.post(endpoint, {
          number: formattedNumber,
          text: message,
          delay: 1000
        });

        return {
          success: true,
          messageId: response.data.key?.id,
          data: response.data
        };
      } catch (primaryErr) {
        // If provider complains about missing `textMessage` property, try alternative payload shapes
        const providerMsg = primaryErr?.response?.data?.response?.message || primaryErr?.response?.data?.message || '';
        if (/textMessage/i.test(providerMsg)) {
          const altPayloads = [
            { number: formattedNumber, textMessage: message, delay: 1000 },
            { number: formattedNumber, textMessage: { text: message }, delay: 1000 },
            { number: formattedNumber, message: { text: message }, delay: 1000 }
          ];

          for (const payload of altPayloads) {
            try {
              const retryResp = await this.client.post(endpoint, payload);
              return {
                success: true,
                messageId: retryResp.data.key?.id,
                data: retryResp.data
              };
            } catch (retryErr) {
              // continue to next payload
            }
          }
        }

        // If no alternative worked, throw the original error to be handled by caller
        throw primaryErr;
      }
    } catch (error) {
        console.error('Failed to send text message:', error.message);
        // If Axios provided a response, attach it to a new Error so callers can
        // inspect `err.response` and `err.response.data`. Otherwise rethrow.
        if (error && error.response) {
          const e = new Error(`WhatsApp message failed: ${error.response.data?.message || error.message}`);
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
  async sendMediaMessage(phoneNumber, mediaUrl, caption = '', mediaType = 'image') {
    if (!this.configured) {
      throw new Error('Evolution API not configured');
    }

    try {
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      
      const endpoint = mediaType === 'document' 
        ? `/message/sendMedia/${this.instanceName}`
        : `/message/sendMedia/${this.instanceName}`;

      const payload = {
        number: formattedNumber,
        mediatype: mediaType === 'document' ? 'document' : 'image',
        media: mediaUrl,
        caption: caption,
        delay: 1000
      };

      // Add filename for documents
      if (mediaType === 'document') {
        payload.fileName = 'marksheet.pdf';
      }

      const response = await this.client.post(endpoint, payload);

      return {
        success: true,
        messageId: response.data.key?.id,
        data: response.data
      };
    } catch (error) {
        console.error('Failed to send media message:', error.message);
        if (error && error.response) {
          const e = new Error(`WhatsApp media message failed: ${error.response.data?.message || error.message}`);
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
          // Send the document with an empty caption to ensure the file appears first
          await this.sendMediaMessage(
            parentPhoneNumber,
            pdfUrl,
            '',
            'document'
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
