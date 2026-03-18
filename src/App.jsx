import { useCallback, useEffect, useMemo, useState } from 'react'
import GridLayout, { WidthProvider } from 'react-grid-layout/legacy'
import ChartErrorBoundary from './components/ChartErrorBoundary'
import FilterPanel from './components/FilterPanel'
import RadialChart from './components/RadialChart'
import {
  SELLER_FILTERS,
  formatCurrency,
  formatPercent,
  getFilteredSellerSegments,
  getFilteredTotal,
  getTrafficBreakdown,
  getVisibleSellers,
} from './data'
import 'react-grid-layout/css/styles.css'
import './styles/app.css'

const AutoWidthGridLayout = WidthProvider(GridLayout)

const STORAGE_KEY_V3 = 'amazon-revenue-layout-v3'
const GRID_COLUMNS = 12
const GRID_ROW_HEIGHT = 16
const GRID_MARGIN = [10, 10]
const GRID_CONTAINER_PADDING = [10, 10]

const WIDGET_LIBRARY = {
  revenueHalfMoon: {
    title: 'Revenue Half-Moon',
    layout: { x: 0, y: 0, w: 5, h: 20 },
  },
  trafficBreakdown: {
    title: 'Traffic Breakdown',
    layout: { x: 8, y: 0, w: 2, h: 8 },
  },
  sellerContribution: {
    title: 'Seller Contribution',
    layout: { x: 0, y: 18, w: 2, h: 9 },
  },
  kpiOverview: {
    title: 'Topline KPIs',
    layout: { x: 6, y: 18, w: 2, h: 10 },
  },
}

const DEFAULT_WIDGET_ORDER = [
  'revenueHalfMoon',
  'trafficBreakdown',
  'sellerContribution',
  'kpiOverview',
]

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

function sortLayoutItems(layoutItems) {
  return [...layoutItems].sort((a, b) => a.y - b.y || a.x - b.x)
}

function cloneLayoutItems(layoutItems) {
  return layoutItems.map((item) => ({ ...item }))
}

function enforceFixedWidgetDimensions(layoutItems) {
  if (!Array.isArray(layoutItems) || !layoutItems.length) {
    return layoutItems
  }

  let hasChange = false

  const normalized = layoutItems
    .map((item) => {
    const widgetMeta = WIDGET_LIBRARY[item.type]
    if (!widgetMeta) {
      hasChange = true
      return null
    }

    const width = widgetMeta.layout.w
    const height = widgetMeta.layout.h
    const nextX = clamp(item.x, 0, Math.max(0, GRID_COLUMNS - width))

    if (item.w !== width || item.h !== height || item.x !== nextX) {
      hasChange = true
      return {
        ...item,
        x: nextX,
        w: width,
        h: height,
      }
    }

      return item
    })
    .filter(Boolean)

  return hasChange ? sortLayoutItems(normalized) : layoutItems
}

function getDefaultLayoutItems() {
  return DEFAULT_WIDGET_ORDER.map((type) => ({
    id: type,
    type,
    ...WIDGET_LIBRARY[type].layout,
  }))
}

function loadInitialLayout() {
  if (typeof window === 'undefined') {
    return getDefaultLayoutItems()
  }

  try {
    const v3Raw = window.localStorage.getItem(STORAGE_KEY_V3)
    if (!v3Raw) {
      return getDefaultLayoutItems()
    }

    const parsedV3 = JSON.parse(v3Raw)
    if (!Array.isArray(parsedV3)) {
      return getDefaultLayoutItems()
    }

    const seenIds = new Set()
    const normalized = parsedV3
      .map((item) => {
        if (!item || typeof item !== 'object' || typeof item.type !== 'string') {
          return null
        }

        const widgetMeta = WIDGET_LIBRARY[item.type]
        if (!widgetMeta) {
          return null
        }

        // Drag-only mode: widget sizes are fixed by widget type.
        const width = widgetMeta.layout.w
        const height = widgetMeta.layout.h
        const xValue = Number(item.x)
        const yValue = Number(item.y)
        const x = clamp(
          Number.isFinite(xValue) ? Math.floor(xValue) : widgetMeta.layout.x,
          0,
          Math.max(0, GRID_COLUMNS - width),
        )
        const y = Math.max(0, Number.isFinite(yValue) ? Math.floor(yValue) : widgetMeta.layout.y)
        const id = typeof item.id === 'string' && item.id ? item.id : item.type

        if (seenIds.has(id)) {
          return null
        }

        seenIds.add(id)
        return {
          id,
          type: item.type,
          x,
          y,
          w: width,
          h: height,
        }
      })
      .filter(Boolean)

    return normalized.length ? normalized : getDefaultLayoutItems()
  } catch {
    return getDefaultLayoutItems()
  }
}

function getStoragePayload(layoutItems) {
  return layoutItems.map((item) => ({
    id: item.id,
    type: item.type,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
  }))
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
    sellerSegments,
    trafficBreakdown,
    onSellerChange,
    isEditMode,
  } = context

  switch (widgetType) {
    case 'revenueHalfMoon':
      return (
        <div className="half-moon-widget">
          <div className="half-moon-widget__filters widget-no-drag">
            <FilterPanel
              sellerFilter={sellerFilter}
              onSellerChange={onSellerChange}
            />
          </div>
          <div className="half-moon-widget__chart">
            <ChartErrorBoundary>
              <RadialChart
                sellerSegments={sellerSegments}
                trafficBreakdown={trafficBreakdown}
                filteredTotal={filteredTotal}
                isInteractive={!isEditMode}
              />
            </ChartErrorBoundary>
          </div>
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
  const [savedLayoutItems, setSavedLayoutItems] = useState(() =>
    enforceFixedWidgetDimensions(loadInitialLayout()),
  )
  const [draftLayoutItems, setDraftLayoutItems] = useState(null)
  const [isGridDragging, setIsGridDragging] = useState(false)

  const activeLayoutItems = useMemo(
    () =>
      enforceFixedWidgetDimensions(
        isEditMode ? draftLayoutItems ?? savedLayoutItems : savedLayoutItems,
      ),
    [draftLayoutItems, isEditMode, savedLayoutItems],
  )

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

  const layout = useMemo(
    () =>
      activeLayoutItems.map((item) => ({
        i: item.id,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
      })),
    [activeLayoutItems],
  )

  const widgetContext = useMemo(
    () => ({
      sellerFilter,
      filteredTotal,
      sellerSegments,
      trafficBreakdown,
      onSellerChange: setSellerFilter,
      isEditMode,
    }),
    [
      sellerFilter,
      filteredTotal,
      sellerSegments,
      trafficBreakdown,
      isEditMode,
    ],
  )

  const scaffoldRowCount = useMemo(() => {
    const maxY = activeLayoutItems.reduce(
      (highest, item) => Math.max(highest, item.y + item.h),
      0,
    )
    return Math.max(1, maxY)
  }, [activeLayoutItems])

  const showSlotScaffold = isEditMode && isGridDragging

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(
      STORAGE_KEY_V3,
      JSON.stringify(getStoragePayload(savedLayoutItems)),
    )
  }, [savedLayoutItems])

  const syncLayoutFromGrid = useCallback((nextLayout) => {
    if (!isEditMode) {
      return
    }

    setDraftLayoutItems((currentItems) => {
      if (!currentItems?.length) {
        return currentItems
      }

      const existingById = new Map(currentItems.map((item) => [item.id, item]))
      let hasChange = false

      const nextItems = nextLayout
        .map((layoutItem) => {
          const existingItem = existingById.get(layoutItem.i)
          if (!existingItem) {
            return null
          }

          const widgetMeta = WIDGET_LIBRARY[existingItem.type]
          const fixedWidth = widgetMeta?.layout.w ?? existingItem.w
          const nextX = clamp(layoutItem.x, 0, Math.max(0, GRID_COLUMNS - fixedWidth))
          const nextY = Math.max(0, layoutItem.y)
          if (nextX !== existingItem.x || nextY !== existingItem.y) {
            hasChange = true
          }

          return {
            ...existingItem,
            x: nextX,
            y: nextY,
          }
        })
        .filter(Boolean)

      if (!hasChange) {
        return currentItems
      }

      return sortLayoutItems(nextItems)
    })
  }, [isEditMode])

  const startLayoutEdit = useCallback(() => {
    setDraftLayoutItems(cloneLayoutItems(enforceFixedWidgetDimensions(savedLayoutItems)))
    setIsGridDragging(false)
    setIsEditMode(true)
  }, [savedLayoutItems])

  const cancelLayoutEdit = useCallback(() => {
    setIsGridDragging(false)
    setIsEditMode(false)
    setDraftLayoutItems(null)
  }, [])

  const saveLayoutEdit = useCallback(() => {
    if (draftLayoutItems?.length) {
      setSavedLayoutItems(
        sortLayoutItems(cloneLayoutItems(enforceFixedWidgetDimensions(draftLayoutItems))),
      )
    }

    setIsGridDragging(false)
    setIsEditMode(false)
    setDraftLayoutItems(null)
  }, [draftLayoutItems])

  return (
    <main className={`analytics-shell ${isEditMode ? 'is-editing' : ''}`}>
      <header className="analytics-header">
        <div className="analytics-header__left">
          <h1 className='header-text'>Analytics</h1>
        </div>

        <div className="analytics-header__actions">
          {!isEditMode && (
            <button
              className="action-btn action-btn--edit"
              onClick={startLayoutEdit}
              type="button"
            >
              <PencilIcon />
              Edit Layout
            </button>
          )}

          {isEditMode && (
            <>
              <button
                className="action-btn action-btn--edit is-active"
                onClick={saveLayoutEdit}
                type="button"
              >
                Save
              </button>
              <button className="action-btn" onClick={cancelLayoutEdit} type="button">
                Cancel
              </button>
            </>
          )}
        </div>
      </header>

      <section className="dashboard-workspace">
        <section className="dashboard-main">
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
              isResizable={false}
              layout={layout}
              margin={GRID_MARGIN}
              onDragStart={() => setIsGridDragging(true)}
              onDragStop={(nextLayout) => {
                syncLayoutFromGrid(nextLayout)
                setIsGridDragging(false)
              }}
              onLayoutChange={syncLayoutFromGrid}
              preventCollision={false}
              rowHeight={GRID_ROW_HEIGHT}
              useCSSTransforms
            >
              {activeLayoutItems.map((widget) => {
                const widgetMeta = WIDGET_LIBRARY[widget.type]
                if (!widgetMeta) {
                  return null
                }

                return (
                  <div className="widget-grid-item" key={widget.id}>
                    <article
                      className={`widget-card widget-card--${widget.type} ${isEditMode ? 'is-editing' : ''}`}
                    >
                      <header className="widget-card__header">
                        <h3>{widgetMeta.title}</h3>
                      </header>

                      <div className={`widget-card__body widget-card__body--${widget.type}`}>
                        <div className={`widget-content-probe widget-content-probe--${widget.type}`}>
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
