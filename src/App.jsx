//app.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import GridLayout, { WidthProvider } from 'react-grid-layout/legacy'
import ChartErrorBoundary from './components/ChartErrorBoundary'
import FilterPanel from './components/FilterPanel'
import RadialChart from './components/RadialChart'
import {
  SELLER_FILTERS,
  formatCurrency,
  formatPercent,
  getCenterLabel,
  getFilteredSellerSegments,
  getFilteredTotal,
  getTrafficBreakdown,
  getVisibleSellers,
} from './data'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import './styles/app.css'

const AutoWidthGridLayout = WidthProvider(GridLayout)

const STORAGE_KEY_V3 = 'amazon-revenue-layout-v3'
const STORAGE_KEY_V2 = 'amazon-revenue-layout-v2'
const GRID_COLUMNS = 12
const GRID_ROW_HEIGHT = 16
const GRID_MARGIN = [10, 10]
const GRID_CONTAINER_PADDING = [0, 0]
const GRID_MARGIN_X = GRID_MARGIN[0]
const GRID_MARGIN_Y = GRID_MARGIN[1]
const AUTO_SIZE_WIDTH_DEADBAND_PX = 18
const AUTO_SIZE_HEIGHT_DEADBAND_PX = 18
const AUTO_SIZE_RULES = {
  filters: {
    minWidth: 200,
    maxWidth: 620,
    minBodyHeight: 56,
    headerHeight: 0,
    heightBuffer: 14,
    autoWidth: true,
    autoHeight: true,
  },
  revenueHalfMoon: {
    minWidth: 620,
    maxWidth: 920,
    minBodyHeight: 184,
    headerHeight: 44,
    heightBuffer: 26,
    autoWidth: false,
    autoHeight: true,
  },
  trafficBreakdown: {
    minWidth: 360,
    maxWidth: 660,
    minBodyHeight: 130,
    headerHeight: 44,
    heightBuffer: 22,
    autoWidth: false,
    autoHeight: true,
  },
  sellerContribution: {
    minWidth: 560,
    maxWidth: 980,
    minBodyHeight: 170,
    headerHeight: 44,
    heightBuffer: 24,
    autoWidth: false,
    autoHeight: true,
  },
  kpiOverview: {
    minWidth: 520,
    maxWidth: 980,
    minBodyHeight: 160,
    headerHeight: 44,
    heightBuffer: 22,
    autoWidth: false,
    autoHeight: true,
  },
}

const WIDGET_LIBRARY = {
  filters: {
    type: 'filters',
    title: 'Filters',
    description: 'Switch 1P, 3P, FBA, and MFN quickly.',
    defaultLayout: { x: 0, y: 0, w: 2, h: 3 },
    minSize: { w: 2, h: 3 },
    maxSize: { w: 6, h: 8 },
  },
  revenueHalfMoon: {
    type: 'revenueHalfMoon',
    title: 'Revenue Half-Moon',
    description: 'Main half-donut revenue breakdown view.',
    defaultLayout: { x: 0, y: 3, w: 7, h: 8 },
    minSize: { w: 6, h: 6 },
    maxSize: { w: 12, h: 24 },
  },
  trafficBreakdown: {
    type: 'trafficBreakdown',
    title: 'Traffic Breakdown',
    description: 'ADS and Organic split with percentages.',
    defaultLayout: { x: 7, y: 3, w: 5, h: 6 },
    minSize: { w: 4, h: 4 },
    maxSize: { w: 6, h: 18 },
  },
  sellerContribution: {
    type: 'sellerContribution',
    title: 'Seller Contribution',
    description: 'Share by seller channel in the active filter.',
    defaultLayout: { x: 0, y: 9, w: 6, h: 7 },
    minSize: { w: 4, h: 6 },
    maxSize: { w: 8, h: 16 },
  },
  kpiOverview: {
    type: 'kpiOverview',
    title: 'Topline KPIs',
    description: 'Revenue, ADS share, and Organic share.',
    defaultLayout: { x: 6, y: 9, w: 6, h: 6 },
    minSize: { w: 4, h: 4 },
    maxSize: { w: 8, h: 16 },
  },
}

const DEFAULT_WIDGET_ORDER = [
  'filters',
  'revenueHalfMoon',
  'trafficBreakdown',
  'sellerContribution',
  'kpiOverview',
]

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

function toInteger(value, fallback = 0) {
  const numberValue = Number.parseInt(value, 10)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

function normalizeType(type) {
  return typeof type === 'string' ? type : ''
}

function sortLayoutItems(layoutItems) {
  return [...layoutItems].sort((a, b) => a.y - b.y || a.x - b.x)
}

function buildLayoutItem(type, overrides = {}) {
  const normalizedType = normalizeType(type)
  const meta = WIDGET_LIBRARY[normalizedType]

  if (!meta) {
    return null
  }

  const desiredWidth = toInteger(overrides.w, meta.defaultLayout.w)
  const desiredHeight = toInteger(overrides.h, meta.defaultLayout.h)

  const w = clamp(desiredWidth, meta.minSize.w, meta.maxSize.w)
  const h = clamp(desiredHeight, meta.minSize.h, meta.maxSize.h)
  const x = clamp(
    toInteger(overrides.x, meta.defaultLayout.x),
    0,
    Math.max(0, GRID_COLUMNS - w),
  )
  const y = Math.max(0, toInteger(overrides.y, meta.defaultLayout.y))

  return {
    id: normalizeType(overrides.id) || normalizedType,
    type: normalizedType,
    x,
    y,
    w,
    h,
    minW: meta.minSize.w,
    minH: meta.minSize.h,
    maxW: meta.maxSize.w,
    maxH: meta.maxSize.h,
  }
}

function getDefaultLayoutItems() {
  return DEFAULT_WIDGET_ORDER.map((type) => buildLayoutItem(type)).filter(Boolean)
}

function normalizeV3Layout(rawLayout) {
  if (!Array.isArray(rawLayout)) {
    return []
  }

  const seenIds = new Set()
  const normalized = rawLayout
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const normalizedItem = buildLayoutItem(item.type, item)
      if (!normalizedItem || seenIds.has(normalizedItem.id)) {
        return null
      }

      seenIds.add(normalizedItem.id)
      return normalizedItem
    })
    .filter(Boolean)

  return sortLayoutItems(normalized)
}

function packSequentially(layoutItems) {
  let cursorX = 0
  let cursorY = 0
  let rowHeight = 0

  return layoutItems.map((item) => {
    const w = clamp(item.w, item.minW, item.maxW)
    const h = clamp(item.h, item.minH, item.maxH)

    if (cursorX + w > GRID_COLUMNS) {
      cursorX = 0
      cursorY += rowHeight
      rowHeight = 0
    }

    const nextItem = {
      ...item,
      x: cursorX,
      y: cursorY,
      w,
      h,
    }

    cursorX += w
    rowHeight = Math.max(rowHeight, h)

    return nextItem
  })
}

function migrateV2Layout(rawLayout) {
  if (!Array.isArray(rawLayout)) {
    return []
  }

  const seenIds = new Set()
  const converted = rawLayout
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const type = normalizeType(item.type)
      const convertedItem = buildLayoutItem(type, {
        id: item.id,
        w: item.colSpan,
        h: item.rowSpan,
        x: 0,
        y: 0,
      })

      if (!convertedItem || seenIds.has(convertedItem.id)) {
        return null
      }

      seenIds.add(convertedItem.id)
      return convertedItem
    })
    .filter(Boolean)

  return packSequentially(converted)
}

function loadInitialLayout() {
  if (typeof window === 'undefined') {
    return getDefaultLayoutItems()
  }

  try {
    const v3Raw = window.localStorage.getItem(STORAGE_KEY_V3)
    if (v3Raw) {
      const parsedV3 = JSON.parse(v3Raw)
      const normalizedV3 = normalizeV3Layout(parsedV3)
      if (normalizedV3.length) {
        return normalizedV3
      }
    }
  } catch {
    // Fall back to v2 or defaults.
  }

  try {
    const v2Raw = window.localStorage.getItem(STORAGE_KEY_V2)
    if (v2Raw) {
      const parsedV2 = JSON.parse(v2Raw)
      const migratedV2 = migrateV2Layout(parsedV2)
      if (migratedV2.length) {
        return migratedV2
      }
    }
  } catch {
    // Use defaults below.
  }

  return getDefaultLayoutItems()
}

function getStoragePayload(layoutItems) {
  return layoutItems.map((item) => ({
    id: item.id,
    type: item.type,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    minW: item.minW,
    minH: item.minH,
    maxW: item.maxW,
    maxH: item.maxH,
  }))
}

function getGridColumnWidth(containerWidth) {
  const horizontalMargins = GRID_MARGIN_X * (GRID_COLUMNS - 1)
  const horizontalPadding = GRID_CONTAINER_PADDING[0] * 2
  const availableWidth = containerWidth - horizontalMargins - horizontalPadding

  if (availableWidth <= 0) {
    return 0
  }

  return availableWidth / GRID_COLUMNS
}

function pixelsToColumns(pixels, columnWidth) {
  if (!Number.isFinite(pixels) || pixels <= 0 || columnWidth <= 0) {
    return 1
  }

  return Math.max(
    1,
    Math.ceil((pixels + GRID_MARGIN_X) / (columnWidth + GRID_MARGIN_X)),
  )
}

function pixelsToRows(pixels) {
  if (!Number.isFinite(pixels) || pixels <= 0) {
    return 1
  }

  return Math.max(
    1,
    Math.ceil((pixels + GRID_MARGIN_Y) / (GRID_ROW_HEIGHT + GRID_MARGIN_Y)),
  )
}

function columnsToPixels(columns, columnWidth) {
  if (!Number.isFinite(columns) || columns <= 0 || columnWidth <= 0) {
    return 0
  }

  return columns * (columnWidth + GRID_MARGIN_X) - GRID_MARGIN_X
}

function rowsToPixels(rows) {
  if (!Number.isFinite(rows) || rows <= 0) {
    return 0
  }

  return rows * (GRID_ROW_HEIGHT + GRID_MARGIN_Y) - GRID_MARGIN_Y
}

function getElementWidth(element) {
  if (!element) {
    return 0
  }

  const boundsWidth = Math.ceil(element.getBoundingClientRect().width)
  return Math.max(boundsWidth, Math.ceil(element.scrollWidth))
}

function getLargestWidth(elements) {
  if (!elements.length) {
    return 0
  }

  return elements.reduce(
    (maxWidth, element) => Math.max(maxWidth, getElementWidth(element)),
    0,
  )
}

function measureWidgetContent(widgetType, probeNode) {
  if (!probeNode) {
    return null
  }

  const rules = AUTO_SIZE_RULES[widgetType] ?? AUTO_SIZE_RULES.filters
  const baseWidth = Math.ceil(probeNode.scrollWidth)
  const baseHeight = Math.ceil(probeNode.scrollHeight)
  let measuredWidth = baseWidth
  let measuredHeight = baseHeight

  switch (widgetType) {
    case 'filters': {
      const filterRow = probeNode.querySelector('.filter-row')
      measuredWidth = Math.ceil((filterRow?.scrollWidth ?? baseWidth) + 20)
      measuredHeight = Math.ceil(baseHeight + 8)
      break
    }
    case 'revenueHalfMoon': {
      const radialVisual = probeNode.querySelector('.radial-chart-visual')
      const chip = probeNode.querySelector('.widget-chip')
      measuredWidth = Math.ceil(
        Math.max(getElementWidth(radialVisual), getElementWidth(chip), baseWidth) + 24,
      )
      measuredHeight = Math.ceil(
        Math.max(
          baseHeight + 10,
          Math.ceil(radialVisual?.scrollHeight ?? 0) + 22,
        ),
      )
      break
    }
    case 'trafficBreakdown': {
      const metricRows = Array.from(probeNode.querySelectorAll('.metric-row'))
      measuredWidth = Math.ceil(Math.max(getLargestWidth(metricRows), baseWidth) + 12)
      measuredHeight = Math.ceil(
        Math.max(baseHeight + 10, metricRows.length * 54 + 14),
      )
      break
    }
    case 'sellerContribution': {
      const progressMetas = Array.from(
        probeNode.querySelectorAll('.progress-row__meta'),
      )
      const progressTracks = Array.from(
        probeNode.querySelectorAll('.progress-track'),
      )
      measuredWidth = Math.ceil(
        Math.max(
          getLargestWidth(progressMetas),
          getLargestWidth(progressTracks),
          baseWidth,
        ) + 12,
      )
      measuredHeight = Math.ceil(
        Math.max(baseHeight + 12, progressMetas.length * 44 + 18),
      )
      break
    }
    case 'kpiOverview': {
      const kpiGrid = probeNode.querySelector('.kpi-grid')
      measuredWidth = Math.ceil(Math.max(getElementWidth(kpiGrid), baseWidth) + 12)
      measuredHeight = Math.ceil(Math.max(baseHeight + 10, 150))
      break
    }
    default: {
      measuredWidth = Math.ceil(baseWidth + 12)
      measuredHeight = Math.ceil(baseHeight + 10)
    }
  }

  return {
    width: clamp(measuredWidth, rules.minWidth, rules.maxWidth),
    height: Math.max(rules.minBodyHeight, measuredHeight),
  }
}

function autoSizeLayoutItems(layoutItems, measurementsById, containerWidth) {
  if (!measurementsById.size) {
    return layoutItems
  }

  const columnWidth = getGridColumnWidth(containerWidth)
  if (columnWidth <= 0) {
    return layoutItems
  }

  let hasChange = false

  const nextItems = layoutItems.map((item) => {
    const measurement = measurementsById.get(item.id)
    if (!measurement) {
      return item
    }

    const widgetRules = AUTO_SIZE_RULES[item.type] ?? AUTO_SIZE_RULES.filters
    const targetWidthPx = measurement.width
    const targetHeightPx =
      measurement.height + widgetRules.headerHeight + widgetRules.heightBuffer
    const measuredWidth = clamp(
      pixelsToColumns(targetWidthPx, columnWidth),
      item.minW,
      item.maxW,
    )
    const measuredHeight = clamp(
      pixelsToRows(targetHeightPx),
      item.minH,
      item.maxH,
    )
    const widthNeedsUpdate =
      widgetRules.autoWidth &&
      Math.abs(columnsToPixels(item.w, columnWidth) - targetWidthPx) >
        AUTO_SIZE_WIDTH_DEADBAND_PX &&
      measuredWidth !== item.w
    const heightNeedsUpdate =
      widgetRules.autoHeight &&
      Math.abs(rowsToPixels(item.h) - targetHeightPx) >
        AUTO_SIZE_HEIGHT_DEADBAND_PX &&
      measuredHeight !== item.h
    const nextWidth = widthNeedsUpdate ? measuredWidth : item.w
    const nextHeight = heightNeedsUpdate ? measuredHeight : item.h
    const nextX = clamp(item.x, 0, Math.max(0, GRID_COLUMNS - nextWidth))

    if (item.w === nextWidth && item.h === nextHeight && item.x === nextX) {
      return item
    }

    hasChange = true
    return {
      ...item,
      x: nextX,
      w: nextWidth,
      h: nextHeight,
    }
  })

  return hasChange ? sortLayoutItems(nextItems) : layoutItems
}

function ClockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="icon-svg" focusable="false">
      <path
        d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 5h-2v6l5 3 1-1.73-4-2.27V7z"
        fill="currentColor"
      />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="icon-svg" focusable="false">
      <path
        d="M4 16.25V20h3.75L19.81 7.94l-3.75-3.75L4 16.25z"
        fill="currentColor"
      />
      <path
        d="M20.71 6.04a1 1 0 000-1.41l-1.34-1.34a1 1 0 00-1.41 0l-1.04 1.04 3.75 3.75 1.04-1z"
        fill="currentColor"
      />
    </svg>
  )
}

function renderWidgetBody(widgetType, context) {
  const {
    sellerFilter,
    filteredTotal,
    centerLabel,
    sellerSegments,
    trafficBreakdown,
    onSellerChange,
    isEditMode,
  } = context

  switch (widgetType) {
    case 'filters':
      return (
        <FilterPanel
          sellerFilter={sellerFilter}
          onSellerChange={onSellerChange}
        />
      )
    case 'revenueHalfMoon':
      return (
        <div className="half-moon-widget">
          <span className="widget-chip">{centerLabel}</span>
          <ChartErrorBoundary>
            <RadialChart
              sellerSegments={sellerSegments}
              trafficBreakdown={trafficBreakdown}
              filteredTotal={filteredTotal}
              isInteractive={!isEditMode}
            />
          </ChartErrorBoundary>
        </div>
      )
    case 'trafficBreakdown':
      return (
        <div className="metric-stack">
          {trafficBreakdown.map((segment) => (
            <div className="metric-row" key={segment.key}>
              <div className="metric-row__left">
                <p>{segment.longLabel}</p>
                <small>{formatPercent(segment.percentage)}</small>
              </div>
              <strong>{formatCurrency(segment.value)}</strong>
            </div>
          ))}
        </div>
      )
    case 'sellerContribution':
      return (
        <div className="progress-stack">
          {sellerSegments.map((segment) => (
            <div className="progress-row" key={segment.key}>
              <div className="progress-row__meta">
                <p>{segment.label}</p>
                <span>{`${formatCurrency(segment.value)} | ${formatPercent(segment.percentage)}`}</span>
              </div>
              <div className="progress-track">
                <span
                  className="progress-fill"
                  style={{
                    width: `${Math.max(segment.percentage, 4)}%`,
                    background: segment.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )
    case 'kpiOverview': {
      const adsSegment = trafficBreakdown.find((item) => item.key === 'ADS')
      const organicSegment = trafficBreakdown.find(
        (item) => item.key === 'Organic',
      )

      return (
        <div className="kpi-grid">
          <article className="kpi-card">
            <p>Total Revenue</p>
            <strong>{formatCurrency(filteredTotal)}</strong>
          </article>
          <article className="kpi-card">
            <p>ADS Share</p>
            <strong>{formatPercent(adsSegment?.percentage ?? 0)}</strong>
            <small>{formatCurrency(adsSegment?.value ?? 0)}</small>
          </article>
          <article className="kpi-card">
            <p>Organic Share</p>
            <strong>{formatPercent(organicSegment?.percentage ?? 0)}</strong>
            <small>{formatCurrency(organicSegment?.value ?? 0)}</small>
          </article>
        </div>
      )
    }
    default:
      return (
        <div className="chart-error-state">
          <p className="chart-error-state__title">Widget unavailable</p>
          <p className="chart-error-state__body">
            This widget configuration is no longer available.
          </p>
        </div>
      )
  }
}

function App() {
  const [sellerFilter, setSellerFilter] = useState(SELLER_FILTERS.ALL)
  const [isEditMode, setIsEditMode] = useState(false)
  const [layoutItems, setLayoutItems] = useState(() => loadInitialLayout())
  const [pendingResetVersion, setPendingResetVersion] = useState(0)
  const [isGridDragging, setIsGridDragging] = useState(false)
  const [isGridResizing, setIsGridResizing] = useState(false)
  const widgetProbeNodesRef = useRef(new Map())
  const autoFitFrameRef = useRef(null)
  const resetOuterFrameRef = useRef(null)
  const resetInnerFrameRef = useRef(null)
  const isResetSettlingRef = useRef(false)
  const gridWidthRef = useRef(0)

  const activeSellerKeys = useMemo(
    () => getVisibleSellers(sellerFilter),
    [sellerFilter],
  )

  const filteredTotal = useMemo(
    () => getFilteredTotal(activeSellerKeys),
    [activeSellerKeys],
  )

  const sellerSegments = useMemo(
    () => getFilteredSellerSegments(activeSellerKeys),
    [activeSellerKeys],
  )

  const trafficBreakdown = useMemo(
    () => getTrafficBreakdown(activeSellerKeys),
    [activeSellerKeys],
  )

  const centerLabel = useMemo(() => getCenterLabel(sellerFilter), [sellerFilter])

  const collectWidgetMeasurements = useCallback(() => {
    const measurements = new Map()

    widgetProbeNodesRef.current.forEach((probeNode, widgetId) => {
      const widgetType = probeNode.dataset.widgetType
      if (!widgetType) {
        return
      }

      const measurement = measureWidgetContent(widgetType, probeNode)
      if (measurement) {
        measurements.set(widgetId, measurement)
      }
    })

    return measurements
  }, [])

  const scheduleAutoFit = useCallback(() => {
    if (
      isEditMode ||
      isResetSettlingRef.current ||
      typeof window === 'undefined'
    ) {
      return
    }

    if (autoFitFrameRef.current !== null) {
      return
    }

    autoFitFrameRef.current = window.requestAnimationFrame(() => {
      autoFitFrameRef.current = null
      const measurements = collectWidgetMeasurements()
      if (!measurements.size || gridWidthRef.current <= 0) {
        return
      }

      setLayoutItems((currentItems) =>
        autoSizeLayoutItems(
          currentItems,
          measurements,
          gridWidthRef.current,
        ),
      )
    })
  }, [collectWidgetMeasurements, isEditMode])

  const setWidgetProbeNode = useCallback(
    (widgetId, widgetType, probeNode) => {
      const existingNode = widgetProbeNodesRef.current.get(widgetId)
      if (existingNode === probeNode) {
        return
      }

      if (!probeNode) {
        widgetProbeNodesRef.current.delete(widgetId)
        return
      }

      probeNode.dataset.widgetId = widgetId
      probeNode.dataset.widgetType = widgetType
      widgetProbeNodesRef.current.set(widgetId, probeNode)
    },
    [],
  )

  const handleGridWidthChange = useCallback(
    (containerWidth) => {
      const nextWidth = Math.ceil(containerWidth)
      if (nextWidth <= 0 || nextWidth === gridWidthRef.current) {
        return
      }

      gridWidthRef.current = nextWidth

      if (isResetSettlingRef.current) {
        return
      }

      scheduleAutoFit()
    },
    [scheduleAutoFit],
  )

  const handleSellerChange = useCallback((nextFilter) => {
    setSellerFilter(nextFilter)
  }, [])

  const layout = useMemo(
    () =>
      layoutItems.map((item) => ({
        i: item.id,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        minW: item.minW,
        minH: item.minH,
        maxW: item.maxW,
        maxH: item.maxH,
      })),
    [layoutItems],
  )

  const widgetContext = useMemo(
    () => ({
      sellerFilter,
      filteredTotal,
      centerLabel,
      sellerSegments,
      trafficBreakdown,
      onSellerChange: handleSellerChange,
      isEditMode,
    }),
    [
      sellerFilter,
      filteredTotal,
      centerLabel,
      sellerSegments,
      trafficBreakdown,
      handleSellerChange,
      isEditMode,
    ],
  )

  const scaffoldRowCount = useMemo(() => {
    const maxY = layoutItems.reduce(
      (highest, item) => Math.max(highest, item.y + item.h),
      0,
    )
    return Math.max(8, maxY + 2)
  }, [layoutItems])

  const showSlotScaffold = isEditMode && (isGridDragging || isGridResizing)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(
      STORAGE_KEY_V3,
      JSON.stringify(getStoragePayload(layoutItems)),
    )
  }, [layoutItems])

  useEffect(
    () => () => {
      if (typeof window !== 'undefined' && autoFitFrameRef.current !== null) {
        window.cancelAnimationFrame(autoFitFrameRef.current)
        autoFitFrameRef.current = null
      }

      if (typeof window !== 'undefined' && resetOuterFrameRef.current !== null) {
        window.cancelAnimationFrame(resetOuterFrameRef.current)
        resetOuterFrameRef.current = null
      }

      if (typeof window !== 'undefined' && resetInnerFrameRef.current !== null) {
        window.cancelAnimationFrame(resetInnerFrameRef.current)
        resetInnerFrameRef.current = null
      }
    },
    [],
  )

  useEffect(() => {
    if (pendingResetVersion === 0 || isEditMode || typeof window === 'undefined') {
      return undefined
    }

    isResetSettlingRef.current = true

    if (resetOuterFrameRef.current !== null) {
      window.cancelAnimationFrame(resetOuterFrameRef.current)
      resetOuterFrameRef.current = null
    }

    if (resetInnerFrameRef.current !== null) {
      window.cancelAnimationFrame(resetInnerFrameRef.current)
      resetInnerFrameRef.current = null
    }

    resetOuterFrameRef.current = window.requestAnimationFrame(() => {
      resetOuterFrameRef.current = null
      resetInnerFrameRef.current = window.requestAnimationFrame(() => {
        resetInnerFrameRef.current = null
        isResetSettlingRef.current = false
        scheduleAutoFit()
        setPendingResetVersion(0)
      })
    })

    return () => {
      if (resetOuterFrameRef.current !== null) {
        window.cancelAnimationFrame(resetOuterFrameRef.current)
        resetOuterFrameRef.current = null
      }

      if (resetInnerFrameRef.current !== null) {
        window.cancelAnimationFrame(resetInnerFrameRef.current)
        resetInnerFrameRef.current = null
      }
    }
  }, [pendingResetVersion, isEditMode, scheduleAutoFit])

  useEffect(() => {
    if (!isEditMode && pendingResetVersion === 0) {
      scheduleAutoFit()
    }
  }, [isEditMode, layoutItems.length, pendingResetVersion, scheduleAutoFit])

  const syncLayoutFromGrid = useCallback((nextLayout) => {
    setLayoutItems((currentItems) => {
      const existingById = new Map(currentItems.map((item) => [item.id, item]))
      let hasChange = nextLayout.length !== currentItems.length

      const nextItems = nextLayout
        .map((layoutItem) => {
          const existingItem = existingById.get(layoutItem.i)
          if (!existingItem) {
            hasChange = true
            return null
          }

          const nextX = Math.max(0, layoutItem.x)
          const nextY = Math.max(0, layoutItem.y)
          const nextW = clamp(layoutItem.w, existingItem.minW, existingItem.maxW)
          const nextH = clamp(layoutItem.h, existingItem.minH, existingItem.maxH)

          if (
            nextX !== existingItem.x ||
            nextY !== existingItem.y ||
            nextW !== existingItem.w ||
            nextH !== existingItem.h
          ) {
            hasChange = true
          }

          return {
            ...existingItem,
            x: nextX,
            y: nextY,
            w: nextW,
            h: nextH,
          }
        })
        .filter(Boolean)

      if (!hasChange) {
        return currentItems
      }

      return sortLayoutItems(nextItems)
    })
  }, [])

  const resetLayout = useCallback(() => {
    setLayoutItems(getDefaultLayoutItems())
    setPendingResetVersion((version) => version + 1)
  }, [])

  return (
    <main className={`analytics-shell ${isEditMode ? 'is-editing' : ''}`}>
      <header className="analytics-header">
        <div className="analytics-header__left">
          <h1>Analytics</h1>
          <p>
            <ClockIcon /> Last refreshed: 12:36 PM
          </p>
        </div>

        <div className="analytics-header__actions">
          <button
            className={`action-btn action-btn--edit ${isEditMode ? 'is-active' : ''}`}
            onClick={() => setIsEditMode((current) => !current)}
            type="button"
          >
            <PencilIcon />
            {isEditMode ? 'Done Editing' : 'Edit Layout'}
          </button>

          <button className="action-btn" onClick={resetLayout} type="button">
            Reset Layout
          </button>
        </div>
      </header>

      <section className="analytics-toolbar">
        <button className="toolbar-chip">Today</button>
        <button className="toolbar-chip">Mar 17, 2026</button>
        <button className="toolbar-chip">USD</button>
      </section>

      <section className="dashboard-workspace">
        <section className="dashboard-main">
          <div className="dashboard-main__heading">
            <h2>Dashboard</h2>
          </div>

          <div
            className={`dashboard-grid-shell ${showSlotScaffold ? 'is-guided' : ''}`}
          >
            <div
              aria-hidden="true"
              className={`slot-scaffold ${showSlotScaffold ? 'is-visible' : ''}`}
            >
              {Array.from({ length: scaffoldRowCount * GRID_COLUMNS }, (_, index) => (
                <span className="slot-scaffold__cell" key={`slot-${index}`} />
              ))}
            </div>

            <AutoWidthGridLayout
              className={`dashboard-grid-layout ${isEditMode ? 'is-editing' : ''}`}
              cols={GRID_COLUMNS}
              compactType="vertical"
              containerPadding={GRID_CONTAINER_PADDING}
              draggableCancel=".widget-no-drag,button,input,textarea,select,label,option"
              isBounded
              isDraggable={isEditMode}
              isResizable={isEditMode}
              layout={layout}
              margin={GRID_MARGIN}
              onDragStart={() => setIsGridDragging(true)}
              onDragStop={() => setIsGridDragging(false)}
              onLayoutChange={syncLayoutFromGrid}
              onResizeStart={() => setIsGridResizing(true)}
              onResizeStop={() => setIsGridResizing(false)}
              onWidthChange={handleGridWidthChange}
              preventCollision={false}
              resizeHandles={['se']}
              rowHeight={GRID_ROW_HEIGHT}
              useCSSTransforms
            >
              {layoutItems.map((widget) => {
                const widgetMeta = WIDGET_LIBRARY[widget.type]

                if (!widgetMeta) {
                  return null
                }

                return (
                  <div className="widget-grid-item" key={widget.id}>
                    <article
                      className={`widget-card widget-card--${widget.type} ${isEditMode ? 'is-editing' : ''}`}
                    >
                      {widget.type !== 'filters' && (
                        <header className="widget-card__header">
                          <h3>{widgetMeta.title}</h3>
                        </header>
                      )}

                      <div className={`widget-card__body widget-card__body--${widget.type}`}>
                        <div
                          className={`widget-content-probe widget-content-probe--${widget.type}`}
                          ref={(probeNode) =>
                            setWidgetProbeNode(widget.id, widget.type, probeNode)
                          }
                        >
                          {renderWidgetBody(widget.type, widgetContext)}
                        </div>
                      </div>
                    </article>
                  </div>
                )
              })}
            </AutoWidthGridLayout>
          </div>
        </section>
      </section>
    </main>
  )
}

export default App
