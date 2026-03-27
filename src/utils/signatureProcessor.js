/**
 * Signature Processing Utility
 * Removes white/light backgrounds and optimizes signatures for PDF display
 */

const TRANSPARENT_ALPHA_THRESHOLD = 10
const EXISTING_TRANSPARENCY_RATIO = 0.05
const BACKGROUND_DISTANCE_THRESHOLD = 40

/**
 * Process uploaded signature image to remove paper background
 * If the upload already has transparency, keep it as-is.
 * Otherwise remove the paper background and normalize the signature to black.
 * @param {string} dataUrl - Base64 image data URL
 * @returns {Promise<string>} - Processed image data URL
 */
export const processSignatureImage = (dataUrl) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    
    img.onload = () => {
      try {
        // Create canvas for processing
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')

        // Draw the original image
        ctx.drawImage(img, 0, 0)

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data

        let transparentPixels = 0
        const totalPixels = data.length / 4
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] <= TRANSPARENT_ALPHA_THRESHOLD) transparentPixels++
        }

        const hasTransparentBackground = (transparentPixels / totalPixels) >= EXISTING_TRANSPARENCY_RATIO

        // Step 1: Detect background color (most common color = paper)
        const colorFreq = {}
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          const a = data[i + 3]
          
          if (a > 200) { // Only consider non-transparent pixels
            // Create a key for the color (quantized to reduce variations)
            const key = `${Math.round(r/10)*10},${Math.round(g/10)*10},${Math.round(b/10)*10}`
            colorFreq[key] = (colorFreq[key] || 0) + 1
          }
        }

        // Find the most common color (background/paper)
        let bgColor = { r: 255, g: 255, b: 255 } // Default white
        let maxFreq = 0
        for (const [key, freq] of Object.entries(colorFreq)) {
          if (freq > maxFreq) {
            maxFreq = freq
            const [r, g, b] = key.split(',').map(Number)
            bgColor = { r, g, b }
          }
        }

        // Step 2: Use existing transparency when present, otherwise remove paper
        // background and convert the remaining ink to black.
        let hasSignature = false
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          const a = data[i + 3]

          if (hasTransparentBackground) {
            if (a > TRANSPARENT_ALPHA_THRESHOLD) {
              hasSignature = true
            } else {
              data[i + 3] = 0
            }
            continue
          }

          // Calculate color distance from background color
          const rDist = Math.abs(r - bgColor.r)
          const gDist = Math.abs(g - bgColor.g)
          const bDist = Math.abs(b - bgColor.b)
          const colorDistance = Math.sqrt(rDist * rDist + gDist * gDist + bDist * bDist)

          // If pixel is very similar to the paper, make it transparent.
          // Pixels closer to the threshold are softly faded to keep anti-aliased edges.
          if (colorDistance < BACKGROUND_DISTANCE_THRESHOLD || a < 128) {
            // Make transparent (background)
            data[i + 3] = 0
          } else {
            const alphaBoost = Math.min(1, (colorDistance - BACKGROUND_DISTANCE_THRESHOLD) / 50)
            data[i] = 0
            data[i + 1] = 0
            data[i + 2] = 0
            data[i + 3] = Math.max(1, Math.round(a * alphaBoost))
            hasSignature = true
          }
        }

        ctx.putImageData(imageData, 0, 0)

        // Step 3: Find bounding box of non-transparent pixels (signature)
        const pixelData = ctx.getImageData(0, 0, canvas.width, canvas.height).data
        let minX = canvas.width
        let minY = canvas.height
        let maxX = 0
        let maxY = 0

        for (let i = 3; i < pixelData.length; i += 4) {
          if (pixelData[i] > 0) { // If alpha > 0 (not transparent)
            const pixelIndex = (i / 4) | 0
            const x = pixelIndex % canvas.width
            const y = (pixelIndex / canvas.width) | 0

            minX = Math.min(minX, x)
            minY = Math.min(minY, y)
            maxX = Math.max(maxX, x)
            maxY = Math.max(maxY, y)
          }
        }

        if (!hasSignature) {
          reject(new Error('No signature detected. Please ensure pen strokes are visible and distinct from the paper.'))
          return
        }

        // Step 4: Add padding and crop
        const padding = 15
        minX = Math.max(0, minX - padding)
        minY = Math.max(0, minY - padding)
        maxX = Math.min(canvas.width, maxX + padding)
        maxY = Math.min(canvas.height, maxY + padding)

        // Create cropped canvas with transparent background
        const croppedCanvas = document.createElement('canvas')
        croppedCanvas.width = maxX - minX
        croppedCanvas.height = maxY - minY

        const croppedCtx = croppedCanvas.getContext('2d')
        // Keep transparent background; draw only signature pixels
        croppedCtx.drawImage(
          canvas,
          minX, minY, maxX - minX, maxY - minY,
          0, 0, croppedCanvas.width, croppedCanvas.height
        )

        resolve(croppedCanvas.toDataURL('image/png'))
      } catch (error) {
        reject(error)
      }
    }

    img.onerror = () => {
      reject(new Error('Failed to load image. Please ensure the file is a valid image.'))
    }

    img.src = dataUrl
  })
}

/**
 * Optimize signature for PDF display
 * Converts to PNG with optimal DPI and dimensions
 * @param {string} dataUrl - Base64 image data URL
 * @param {number} maxWidth - Maximum width in pixels (default 400)
 * @param {number} maxHeight - Maximum height in pixels (default 100)
 * @returns {Promise<string>} - Optimized image data URL
 */
export const optimizeSignatureForPDF = (dataUrl, maxWidth = 400, maxHeight = 100) => {
  return new Promise((resolve, reject) => {
    const img = new Image()

    img.onload = () => {
      try {
        const aspectRatio = img.width / img.height
        let width = maxWidth
        let height = maxHeight

        // Maintain aspect ratio
        if (aspectRatio > maxWidth / maxHeight) {
          height = Math.round(maxWidth / aspectRatio)
        } else {
          width = Math.round(maxHeight * aspectRatio)
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d', { alpha: true })
        ctx.clearRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)

        resolve(canvas.toDataURL('image/png', 0.95))
      } catch (error) {
        reject(error)
      }
    }

    img.onerror = () => {
      reject(new Error('Failed to load image for optimization'))
    }

    img.src = dataUrl
  })
}

/**
 * Validate signature image
 * @param {File} file - File object
 * @returns {Object} - { valid: boolean, error?: string }
 */
export const validateSignatureFile = (file) => {
  const maxSize = 2 * 1024 * 1024 // 2MB
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']

  if (!file) {
    return { valid: false, error: 'No file selected' }
  }

  if (file.size > maxSize) {
    return { valid: false, error: `File too large. Maximum size is ${maxSize / 1024 / 1024}MB` }
  }

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Please use PNG, JPEG, or WebP' }
  }

  return { valid: true }
}

/**
 * Compare two signatures for similarity (basic check)
 * @param {string} sig1 - First signature data URL
 * @param {string} sig2 - Second signature data URL
 * @returns {Promise<number>} - Similarity score 0-1
 */
export const compareSignatures = (sig1, sig2) => {
  return new Promise((resolve) => {
    if (!sig1 || !sig2) {
      resolve(0)
      return
    }

    Promise.all([
      new Promise((resolve) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.src = sig1
      }),
      new Promise((resolve) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.src = sig2
      })
    ]).then(([img1, img2]) => {
      try {
        const canvas1 = document.createElement('canvas')
        canvas1.width = 200
        canvas1.height = 50
        const ctx1 = canvas1.getContext('2d')
        ctx1.drawImage(img1, 0, 0, 200, 50)

        const canvas2 = document.createElement('canvas')
        canvas2.width = 200
        canvas2.height = 50
        const ctx2 = canvas2.getContext('2d')
        ctx2.drawImage(img2, 0, 0, 200, 50)

        const data1 = ctx1.getImageData(0, 0, 200, 50).data
        const data2 = ctx2.getImageData(0, 0, 200, 50).data

        let matches = 0
        for (let i = 0; i < data1.length; i += 4) {
          const diff = Math.abs(data1[i] - data2[i]) +
                      Math.abs(data1[i + 1] - data2[i + 1]) +
                      Math.abs(data1[i + 2] - data2[i + 2])
          if (diff < 100) matches++
        }

        const similarity = matches / (data1.length / 4)
        resolve(Math.min(1, similarity))
      } catch (e) {
        resolve(0)
      }
    }).catch(() => resolve(0))
  })
}
