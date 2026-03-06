import http from 'http'
import { URL } from 'url'
import sharp from 'sharp'

const PORT = process.env.PORT || 4013

// --- Shared helpers ---

async function parseJsonBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString())
}

async function getInputBuffer(body) {
  if (body.url) {
    const response = await fetch(body.url)
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`)
    return Buffer.from(await response.arrayBuffer())
  }
  if (body.base64) return Buffer.from(body.base64, 'base64')
  throw new Error('Missing url or base64 parameter')
}

function jsonResponse(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function errorResponse(res, error) {
  console.error('REPIC error:', error)
  jsonResponse(res, { success: false, error: error.message }, 500)
}

// --- Image processing functions ---

async function removeBackground(inputBuffer) {
  const image = sharp(inputBuffer)
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true })

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const brightness = (r + g + b) / 3
    const saturation = Math.max(r, g, b) - Math.min(r, g, b)
    if (brightness > 200 && saturation < 30) data[i + 3] = 0
  }

  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer()
}

async function generateFavicons(inputBuffer) {
  const sizes = [
    { name: 'favicon16', size: 16 },
    { name: 'favicon32', size: 32 },
    { name: 'apple180', size: 180 },
    { name: 'android192', size: 192 },
    { name: 'android512', size: 512 },
  ]
  const transparent = { r: 0, g: 0, b: 0, alpha: 0 }
  const results = {}

  for (const { name, size } of sizes) {
    const buf = await sharp(inputBuffer)
      .resize(size, size, { fit: 'contain', background: transparent })
      .png()
      .toBuffer()
    results[name] = { base64: buf.toString('base64'), size: buf.length, dimensions: `${size}x${size}` }
  }

  return results
}

async function resizeImage(inputBuffer, { width, height, fit = 'contain', format = 'png' }) {
  let pipeline = sharp(inputBuffer).resize(
    width ? parseInt(width) : null,
    height ? parseInt(height) : null,
    { fit, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  )
  pipeline = pipeline[format]()
  const buf = await pipeline.toBuffer()
  return { base64: buf.toString('base64'), mimeType: `image/${format}`, size: buf.length }
}

async function convertImage(inputBuffer, { format = 'png', quality }) {
  let pipeline = sharp(inputBuffer)
  const opts = quality ? { quality: parseInt(quality) } : {}
  pipeline = pipeline[format](opts)
  const buf = await pipeline.toBuffer()
  return { base64: buf.toString('base64'), mimeType: `image/${format}`, size: buf.length }
}

async function cropImage(inputBuffer, { left, top, width, height }) {
  const buf = await sharp(inputBuffer)
    .extract({ left: parseInt(left), top: parseInt(top), width: parseInt(width), height: parseInt(height) })
    .png()
    .toBuffer()
  return { base64: buf.toString('base64'), mimeType: 'image/png', size: buf.length }
}

async function getMetadata(inputBuffer) {
  const meta = await sharp(inputBuffer).metadata()
  return {
    width: meta.width,
    height: meta.height,
    format: meta.format,
    channels: meta.channels,
    hasAlpha: meta.hasAlpha,
    size: inputBuffer.length,
  }
}

async function compositeImages(baseBuffer, overlayBuffer, { gravity = 'southeast', opacity = 1 }) {
  const overlay = await sharp(overlayBuffer)
    .ensureAlpha(parseFloat(opacity))
    .toBuffer()

  const buf = await sharp(baseBuffer)
    .composite([{ input: overlay, gravity }])
    .png()
    .toBuffer()

  return { base64: buf.toString('base64'), mimeType: 'image/png', size: buf.length }
}

// --- HTTP handler ---

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`)

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return }

  if (url.pathname === '/api/health') {
    return jsonResponse(res, { status: 'ok', service: 'repic' })
  }

  if (req.method !== 'POST') {
    return jsonResponse(res, { error: 'Not found' }, 404)
  }

  try {
    const contentType = req.headers['content-type'] || ''

    // Remove background (keep backward compat with multipart)
    if (url.pathname === '/api/remove-background') {
      if (contentType.includes('application/json')) {
        const body = await parseJsonBody(req)
        const input = await getInputBuffer(body)
        const output = await removeBackground(input)
        return jsonResponse(res, { success: true, data: { base64: output.toString('base64'), mimeType: 'image/png', size: output.length } })
      }
      if (contentType.includes('multipart/form-data') || contentType.includes('image/')) {
        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        const output = await removeBackground(Buffer.concat(chunks))
        res.writeHead(200, { 'Content-Type': 'image/png' })
        res.end(output)
        return
      }
      throw new Error('Unsupported content type')
    }

    // All other endpoints require JSON
    const body = await parseJsonBody(req)
    const input = await getInputBuffer(body)

    if (url.pathname === '/api/favicon') {
      const favicons = await generateFavicons(input)
      return jsonResponse(res, { success: true, data: favicons })
    }

    if (url.pathname === '/api/resize') {
      const data = await resizeImage(input, body)
      return jsonResponse(res, { success: true, data })
    }

    if (url.pathname === '/api/convert') {
      const data = await convertImage(input, body)
      return jsonResponse(res, { success: true, data })
    }

    if (url.pathname === '/api/crop') {
      const data = await cropImage(input, body)
      return jsonResponse(res, { success: true, data })
    }

    if (url.pathname === '/api/metadata') {
      const data = await getMetadata(input)
      return jsonResponse(res, { success: true, data })
    }

    if (url.pathname === '/api/composite') {
      if (!body.overlay_base64 && !body.overlay_url) {
        throw new Error('Missing overlay_base64 or overlay_url parameter')
      }
      const overlayBuffer = body.overlay_base64
        ? Buffer.from(body.overlay_base64, 'base64')
        : Buffer.from(await (await fetch(body.overlay_url)).arrayBuffer())
      const data = await compositeImages(input, overlayBuffer, body)
      return jsonResponse(res, { success: true, data })
    }

    jsonResponse(res, { error: 'Not found' }, 404)
  } catch (error) {
    errorResponse(res, error)
  }
}

const server = http.createServer(handleRequest)
server.listen(PORT, () => console.log(`REPIC server running on port ${PORT}`))
