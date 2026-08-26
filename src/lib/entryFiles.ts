import { useState } from 'react'
import { api } from './apiClient'

export interface EntryFilesReturn {
  fileError: string | null
  clearFileError: () => void
  viewDoc: (label: string) => void
  viewEvidence: (fileKey: string) => void
  viewEndorsement: () => void
}

/**
 * Presigned-URL access to one entry's files, scoped to the caller's role.
 *
 * Reviewers, 3PIC assessors and Adjudicators all read the same entry payload; the ONLY thing that
 * differs is the route prefix their file URLs hang off - /review/entries/{id},
 * /scoring/entries/{id}, /finals/entries/{id}. Injecting that prefix is what lets a single
 * <EntryDossier> serve all three.
 */
export function useEntryFiles(filesBase: string): EntryFilesReturn {
  const [fileError, setFileError] = useState<string | null>(null)

  async function open(path: string, what: string): Promise<void> {
    try {
      const { url } = await api.get<{ url: string }>(path, { auth: true })
      window.open(url, '_blank', 'noopener')
    } catch {
      setFileError(`We couldn\u2019t open ${what}.`)
    }
  }

  return {
    fileError,
    clearFileError: () => setFileError(null),
    viewDoc: (label: string) => open(`${filesBase}/documents/url?label=${encodeURIComponent(label)}`, 'that document'),
    viewEvidence: (fileKey: string) => open(`${filesBase}/evidence/url?fileKey=${encodeURIComponent(fileKey)}`, 'that evidence file'),
    viewEndorsement: () => open(`${filesBase}/endorsement/url`, 'the endorsement document'),
  }
}
