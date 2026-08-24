import { FutureEvent } from '@/src/core/types'

export interface ExternalSearchRequest {
  keyword?: string
  city?: string
}

export interface ExternalSearchResponse {
  events: FutureEvent[]
  total: number
  error?: string
}

export interface ExternalSourceAdapter {
  id: string
  name: string
  type: 'api' | 'scrape' | 'headless'
  
  isConfigured: () => boolean
  
  search: (query: ExternalSearchRequest) => Promise<ExternalSearchResponse>
}
