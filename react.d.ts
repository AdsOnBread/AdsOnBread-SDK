import type { ReactNode } from 'react'

export declare const VERSION: string

export interface AdsOnBreadLinkRange {
  end: number
  start: number
}

export interface AdsOnBreadAd {
  clickUrl: string
  extensionName: string
  format: 'banner' | 'card'
  iconUrl: string
  linkRanges: AdsOnBreadLinkRange[]
  text: string
  test?: boolean
}

export interface AdsOnBreadSlotProps {
  apiKey: string
  placement?: 'banner' | 'card'
  edgeUrl?: string
  language?: string
  theme?: 'dark' | 'light'
  test?: boolean
  fallback?: ReactNode
  onAdLoad?: (ad: AdsOnBreadAd) => void
  onError?: (error: unknown) => void
}

export function AdsOnBreadSlot(props: AdsOnBreadSlotProps): ReactNode
