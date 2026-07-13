import { useState } from 'react'
import { api } from './apiClient'

/**
 * Presigned-URL access to one entry's files, scoped to the caller's role.
 *
 * Reviewers, 3PIC assessors and Adjudicators all read the same entry payload; the ONLY thing that
 * differs is the route prefix their file URLs hang off — /review/entries/{id},
 * /scoring/entries/{id}, /finals/entries/{id}. Injecting that prefix is what lets a single
 * <EntryDossier> serve all three.
 */
export function useEntryFiles(filesBase) {
  const [fileError, setFileError] = useState(null)

  async function open(path, what) {
    try {
      const { url } = await api.get(path, { auth: true })
      window.open(url, '_blank', 'noopener')
    } catch {
      setFileError(`We couldn’t open ${what}.`)
    }
  }

  return {
    fileError,
    clearFileError: () => setFileError(null),
    viewDoc: (label) => open(`${filesBase}/documents/url?label=${encodeURIComponent(label)}`, 'that document'),
    viewEvidence: (fileKey) => open(`${filesBase}/evidence/url?fileKey=${encodeURIComponent(fileKey)}`, 'that evidence file'),
    viewEndorsement: () => open(`${filesBase}/endorsement/url`, 'the endorsement document'),
  }
}
