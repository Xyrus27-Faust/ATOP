// Turning a table on screen into a file someone can email a supplier.
//
// Deliberately tiny and dependency-free: every export here is a handful of rows the user is
// already looking at, so there is nothing to stream and nothing to ask the API for.

/**
 * Quote a cell the way a spreadsheet expects. Only when it has to — a file of needlessly quoted
 * numbers reads as text on import, which is exactly the wrong outcome for a column of counts.
 */
function cell(value) {
  const text = value == null ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Rows (arrays) to CSV text. First row is the header like any other — it is just the first row. */
export function toCsv(rows) {
  return rows.map((row) => row.map(cell).join(',')).join('\r\n')
}

/**
 * Hand the browser a file. The BOM is not decoration: Excel on Windows reads a UTF-8 CSV as
 * Latin-1 without it, and the tour names carry em-dashes.
 */
export function downloadCsv(filename, rows) {
  const blob = new Blob(['﻿', toCsv(rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoking immediately races the download in Safari; a tick is enough and costs nothing.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** `atop-shirt-sizes-2026-09-19.csv` — dated, because these files get kept and compared. */
export function datedFilename(stem, date = new Date()) {
  const iso = new Date(date).toISOString().slice(0, 10)
  return `${stem}-${iso}.csv`
}
