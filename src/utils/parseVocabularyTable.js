const ARABIC_RANGE = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/
const LATIN_RANGE = /[A-Za-zÄÖÜäöüß]/

function isArabic(text) {
  const arabicChars = (text.match(new RegExp(ARABIC_RANGE.source, 'g')) || []).length
  const latinChars = (text.match(new RegExp(LATIN_RANGE.source, 'g')) || []).length
  return arabicChars > latinChars
}

function isSeparatorLine(line) {
  // Lines like "| --- | --- |" or "----" or "====="
  return /^[|\s\-=:]+$/.test(line)
}

function isHeaderLine(line) {
  // Lines like "| Deutsch | Ägyptisch-Arabisch |" — no Arabic script
  const hasArabicScript = ARABIC_RANGE.test(line)
  const lower = line.toLowerCase()
  return (
    !hasArabicScript &&
    (lower.includes('deutsch') || lower.includes('arabisch') || lower.includes('german') || lower.includes('arabic'))
  )
}

function splitLineIntoColumns(line) {
  // Try pipe separator first (most structured format)
  if (line.includes('|')) {
    const pipeParts = line.split('|').map((s) => s.trim()).filter(Boolean)
    if (pipeParts.length >= 2) return pipeParts
  }

  // Try tab separator
  if (line.includes('\t')) {
    const parts = line.split('\t').map((s) => s.trim()).filter(Boolean)
    if (parts.length >= 2) return parts
  }

  // Try 3+ consecutive spaces
  const spaceParts = line.split(/\s{3,}/).map((s) => s.trim()).filter(Boolean)
  if (spaceParts.length >= 2) return spaceParts

  return null
}

/**
 * Parses OCR text output or pasted table text into vocabulary pairs.
 * Expects tabular text with German and Arabic columns.
 * Returns array of { german, arabic } objects.
 */
export function parseVocabularyTable(ocrText) {
  if (!ocrText || typeof ocrText !== 'string') return []

  const lines = ocrText.split('\n').map((l) => l.trim()).filter(Boolean)
  const pairs = []

  for (const line of lines) {
    // Skip separator and header lines
    if (isSeparatorLine(line)) continue
    if (isHeaderLine(line)) continue

    const columns = splitLineIntoColumns(line)
    if (!columns || columns.length < 2) continue

    let german = ''
    let arabic = ''

    // Assign columns based on script detection
    for (const col of columns) {
      if (isArabic(col)) {
        arabic = arabic ? arabic + ' ' + col : col
      } else {
        german = german ? german + ' ' + col : col
      }
    }

    if (german && arabic) {
      pairs.push({ german: german.trim(), arabic: arabic.trim() })
    }
  }

  return pairs
}
