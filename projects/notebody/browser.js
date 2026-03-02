/**
 * NoteBody Browser Automation — Patchright-based NotebookLM automation
 *
 * Shares auth cookies with notebooklm-mcp to avoid duplicate login.
 * Uses patchright (Playwright stealth fork) for anti-detection.
 */

import { chromium } from 'patchright'
import envPaths from 'env-paths'
import path from 'node:path'
import fs from 'node:fs'

const paths = envPaths('notebooklm-mcp', { suffix: '' })
const STATE_PATH = path.join(paths.data, 'browser_state', 'state.json')
const PROFILE_PATH = path.join(paths.data, 'chrome_profile')

const NOTEBOOK_BASE = 'https://notebooklm.google.com'

// ==================== Mutex Lock ====================

let lockPromise = Promise.resolve()

function withLock(fn) {
  const prev = lockPromise
  let resolve
  lockPromise = new Promise(r => { resolve = r })
  return prev.then(() => fn().finally(resolve))
}

// ==================== Browser Context ====================

let browserContext = null

async function getContext(headless = false) {
  if (browserContext) return browserContext

  if (!fs.existsSync(STATE_PATH)) {
    throw new Error(
      `Auth state not found at ${STATE_PATH}. Run setup_auth first via notebooklm-mcp.`
    )
  }

  browserContext = await chromium.launchPersistentContext(PROFILE_PATH, {
    headless,
    channel: 'chrome',
    viewport: { width: 1024, height: 768 },
    locale: 'en-US',
    storageState: STATE_PATH,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  })

  return browserContext
}

export async function closeContext() {
  if (browserContext) {
    try {
      await browserContext.close()
    } catch {
      // ignore
    }
    browserContext = null
  }
}

// ==================== Human-like Typing ====================

async function humanType(page, locator, text) {
  await locator.click()
  for (const char of text) {
    // 160-240 WPM → ~50-75ms per char (assuming 5 chars/word)
    const delay = 50 + Math.random() * 25
    await locator.pressSequentially(char, { delay: 0 })
    await page.waitForTimeout(delay)
  }
}

// ==================== Multi-Selector Helper ====================

async function findVisible(page, selectors, timeoutMs = 10000) {
  const combined = selectors.join(', ')
  try {
    const loc = page.locator(combined).first()
    await loc.waitFor({ state: 'visible', timeout: timeoutMs })
    return loc
  } catch {
    throw new Error(
      `Could not find any visible element matching: ${selectors.join(' | ')}`
    )
  }
}

// ==================== Create Notebook ====================

export async function createNotebook(options = {}) {
  return withLock(async () => {
    const ctx = await getContext()
    const page = await ctx.newPage()

    try {
      await page.goto(NOTEBOOK_BASE, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(2000)

      // Click "New notebook" / "Create" button
      const createBtn = await findVisible(page, [
        'button:has-text("New notebook")',
        'button:has-text("Create")',
        'button:has-text("New Notebook")',
        '[aria-label*="new" i]',
        '[aria-label*="create" i]',
        '.create-notebook-button',
      ])
      await createBtn.click()

      // Wait for navigation to new notebook page
      await page.waitForURL(/\/notebook\//, { timeout: 30000 })
      await page.waitForTimeout(2000)

      const url = page.url()

      // Optionally rename notebook
      let title = 'Untitled notebook'
      if (options.title) {
        try {
          const titleEl = await findVisible(page, [
            '[contenteditable="true"]',
            'input[aria-label*="title" i]',
            'input[aria-label*="name" i]',
            '.notebook-title',
            'h1[contenteditable]',
          ], 5000)

          await titleEl.click({ clickCount: 3 })
          await page.waitForTimeout(300)
          await humanType(page, titleEl, options.title)
          await page.keyboard.press('Enter')
          await page.waitForTimeout(1000)
          title = options.title
        } catch (err) {
          console.warn('[NoteBody] Could not rename notebook:', err.message)
        }
      }

      return { url, title }
    } finally {
      await page.close()
    }
  })
}

// ==================== Add Source ====================

export async function addSource(notebookUrl, sourceUrl) {
  return withLock(async () => {
    const ctx = await getContext()
    const page = await ctx.newPage()

    try {
      await page.goto(notebookUrl, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(2000)

      // Click "Add source" button
      const addBtn = await findVisible(page, [
        'button:has-text("Add source")',
        'button:has-text("Add Source")',
        '[aria-label*="add source" i]',
        '[aria-label*="Add source" i]',
        '.add-source-button',
        'button:has-text("+")',
      ])
      await addBtn.click()
      await page.waitForTimeout(1500)

      // Detect source type from URL
      const isYouTube = /youtube\.com|youtu\.be/i.test(sourceUrl)
      const sourceType = isYouTube ? 'youtube' : 'website'

      // Select source type tab — try clicking YouTube or Website tab
      try {
        if (isYouTube) {
          const ytTab = await findVisible(page, [
            'button:has-text("YouTube")',
            '[aria-label*="YouTube" i]',
            'button:has-text("youtube")',
          ], 5000)
          await ytTab.click()
        } else {
          const webTab = await findVisible(page, [
            'button:has-text("Website")',
            'button:has-text("Link")',
            '[aria-label*="website" i]',
            '[aria-label*="link" i]',
          ], 5000)
          await webTab.click()
        }
        await page.waitForTimeout(1000)
      } catch {
        // Some UI versions may not have separate tabs — continue to URL input
        console.warn('[NoteBody] Source type tab not found, continuing to URL input')
      }

      // Find URL input and type the source URL
      const urlInput = await findVisible(page, [
        'input[type="url"]',
        'input[placeholder*="URL" i]',
        'input[placeholder*="url" i]',
        'input[placeholder*="Paste" i]',
        'input[placeholder*="paste" i]',
        'input[aria-label*="URL" i]',
        'textarea',
      ])
      await humanType(page, urlInput, sourceUrl)
      await page.waitForTimeout(500)

      // Click Insert / Submit / Add button
      const submitBtn = await findVisible(page, [
        'button:has-text("Insert")',
        'button:has-text("Add")',
        'button:has-text("Submit")',
        'button[type="submit"]',
        '[aria-label*="insert" i]',
        '[aria-label*="submit" i]',
      ])
      await submitBtn.click()

      // Wait for source processing — look for success indicators or timeout
      try {
        await page.waitForTimeout(5000)

        // Check for common error indicators
        const errorEl = page.locator('[class*="error" i], [role="alert"]').first()
        const hasError = await errorEl.isVisible({ timeout: 2000 }).catch(() => false)

        if (hasError) {
          const errorText = await errorEl.textContent().catch(() => 'Unknown error')
          throw new Error(`Source add failed: ${errorText}`)
        }
      } catch (err) {
        if (err.message.startsWith('Source add failed')) throw err
        // Otherwise timeout is fine — source might still be processing
      }

      return { success: true, sourceType }
    } finally {
      await page.close()
    }
  })
}
