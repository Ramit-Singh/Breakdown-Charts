export const SELLER_FILTERS = {
  ALL: 'All',
  ONE_P: '1P',
  THREE_P: '3P',
  FBA: 'FBA',
  MFN: 'MFN',
} as const

export type SellerFilter = (typeof SELLER_FILTERS)[keyof typeof SELLER_FILTERS]
export type SellerKey = '1P' | 'FBA' | 'MFN'
export type TrafficKey = 'ADS' | 'Organic'

interface RawSellerData {
  total: number
  ADS: number
  Organic: number
}

export const RAW_DATA: Record<SellerKey, RawSellerData> = {
  '1P': { total: 1000, ADS: 700, Organic: 300 },
  FBA: { total: 500, ADS: 400, Organic: 100 },
  MFN: { total: 2500, ADS: 2000, Organic: 500 },
}

export const SELLER_ORDER: SellerKey[] = ['1P', 'FBA', 'MFN']
export const TRAFFIC_ORDER: TrafficKey[] = ['ADS', 'Organic']

export const SELLER_RING_COLORS: Record<SellerKey, string> = {
  '1P': '#F59E0B',
  FBA: '#EF4444',
  MFN: '#6366F1',
}

export const TRAFFIC_COLORS: Record<TrafficKey, string> = {
  ADS: '#1E293B',
  Organic: '#64748B',
}

export const FILTER_SETS: Record<SellerFilter, SellerKey[]> = {
  [SELLER_FILTERS.ALL]: ['1P', 'FBA', 'MFN'],
  [SELLER_FILTERS.ONE_P]: ['1P'],
  [SELLER_FILTERS.THREE_P]: ['FBA', 'MFN'],
  [SELLER_FILTERS.FBA]: ['FBA'],
  [SELLER_FILTERS.MFN]: ['MFN'],
}

const FILTER_LABELS: Record<SellerFilter, string> = {
  [SELLER_FILTERS.ALL]: 'All',
  [SELLER_FILTERS.ONE_P]: '1P',
  [SELLER_FILTERS.THREE_P]: '3P',
  [SELLER_FILTERS.FBA]: 'FBA',
  [SELLER_FILTERS.MFN]: 'MFN',
}

export interface FilterOption {
  key: SellerFilter
  label: string
  total: number
}

export interface TrafficSegment {
  key: TrafficKey
  label: string
  longLabel: string
  value: number
  color: string
  percentage: number
}

export interface SellerSegment {
  key: SellerKey
  label: string
  value: number
  percentage: number
  color: string
  showLabel: boolean
}

export const FILTER_OPTIONS: FilterOption[] = [
  SELLER_FILTERS.ALL,
  SELLER_FILTERS.ONE_P,
  SELLER_FILTERS.THREE_P,
  SELLER_FILTERS.FBA,
  SELLER_FILTERS.MFN,
].map((filterKey) => ({
  key: filterKey,
  label: FILTER_LABELS[filterKey],
  total: getFilteredTotal(FILTER_SETS[filterKey]),
}))

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

export function getVisibleSellers(filterKey: SellerFilter): SellerKey[] {
  return FILTER_SETS[filterKey] ?? FILTER_SETS[SELLER_FILTERS.ALL]
}

export function getFilteredTotal(activeSellerKeys: SellerKey[]): number {
  return activeSellerKeys.reduce((sum, sellerKey) => sum + RAW_DATA[sellerKey].total, 0)
}

export function getTrafficBreakdown(activeSellerKeys: SellerKey[]): TrafficSegment[] {
  const total = getFilteredTotal(activeSellerKeys)

  return TRAFFIC_ORDER.map((trafficKey) => {
    const value = activeSellerKeys.reduce((sum, sellerKey) => sum + RAW_DATA[sellerKey][trafficKey], 0)

    return {
      key: trafficKey,
      label: trafficKey === 'Organic' ? 'ORG' : trafficKey,
      longLabel: trafficKey,
      value,
      color: TRAFFIC_COLORS[trafficKey],
      percentage: total ? (value / total) * 100 : 0,
    }
  })
}

export function getFilteredSellerSegments(activeSellerKeys: SellerKey[]): SellerSegment[] {
  const filteredTotal = getFilteredTotal(activeSellerKeys)

  return activeSellerKeys.map((sellerKey) => {
    const value = RAW_DATA[sellerKey].total

    return {
      key: sellerKey,
      label: sellerKey,
      value,
      percentage: filteredTotal ? (value / filteredTotal) * 100 : 0,
      color: SELLER_RING_COLORS[sellerKey],
      showLabel: filteredTotal ? (value / filteredTotal) * 180 >= 12 : false,
    }
  })
}

export function getCenterLabel(filterKey: SellerFilter): string {
  switch (filterKey) {
    case SELLER_FILTERS.ALL:
      return 'Total Revenue'
    case SELLER_FILTERS.ONE_P:
      return '1P Revenue'
    case SELLER_FILTERS.THREE_P:
      return '3P Revenue'
    case SELLER_FILTERS.FBA:
      return 'FBA Revenue'
    case SELLER_FILTERS.MFN:
      return 'MFN Revenue'
    default:
      return 'Total Revenue'
  }
}
