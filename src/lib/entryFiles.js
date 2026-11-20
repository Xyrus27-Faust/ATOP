import { createContext, useContext, useState } from 'react'
import { api } from './apiClient'

/**
 * Presigned-URL access to one entry's files, scoped to the caller's role.
 *
 * Reviewers, 3PIC assessors and Adjudicators all read the same entry payload; the ONLY thing that
 * differs is the route prefix their file URLs hang off — /review/entries/{id},
 * /scoring/entries/{id}, /finals/entries/{id}. Injecting that prefix is what lets a single
 * <EntryDossier> serve all three.
 *
 * A failed open records *which* row it came from (`doc:<label>`, `evidence:<fileKey>`,
 * `endorsement`), so the message renders under the button that was clicked. A page-level banner
 * sat a long scroll above the documents, and a reviewer who clicked near the bottom saw nothing.
 */
export function useEntryFiles(filesBase) {
  const [fileError, setFileError] = useState(null)

  async function open(path, target, what) {
    setFileError(null)
    try {
      const { url } = await api.get(path, { auth: true })
      window.open(url, '_blank', 'noopener')
    } catch {
      setFileError({ target, message: `We couldn’t open ${what}.` })
    }
  }

  return {
    fileError,
    clearFileError: () => setFileError(null),
    errorFor: (target) => (fileError?.target === target ? fileError.message : null),
    viewDoc: (label) => open(`${filesBase}/documents/url?label=${encodeURIComponent(label)}`, `doc:${label}`, 'that document'),
    viewEvidence: (fileKey) => open(`${filesBase}/evidence/url?fileKey=${encodeURIComponent(fileKey)}`, `evidence:${fileKey}`, 'that evidence file'),
    viewEndorsement: () => open(`${filesBase}/endorsement/url`, 'endorsement', 'the endorsement document'),
  }
}

/**
 * Carries the page's useEntryFiles() result down to the rows, so a row can show its own error
 * without every section in between passing it along. Review and Finals get it from <EntryDossier>;
 * Scoring composes the sections itself and provides it there.
 */
export const EntryFilesContext = createContext(null)

/** The error message for one row, or null. Rendered outside a provider, there is never one. */
export function useFileErrorFor() {
  const files = useContext(EntryFilesContext)
  return (target) => files?.errorFor(target) ?? null
}
