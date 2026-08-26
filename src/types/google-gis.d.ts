// Global type declarations for Google Identity Services (GIS) SDK loaded via script tag.
interface Window {
  google?: {
    accounts: {
      id: {
        initialize: (config: {
          client_id: string
          callback: (response: { credential: string }) => void
        }) => void
        renderButton: (parent: HTMLElement, options: {
          type?: string
          theme?: string
          size?: string
          text?: string
          shape?: string
          logo_alignment?: string
          width?: number
        }) => void
        prompt: () => void
      }
    }
  }
}
