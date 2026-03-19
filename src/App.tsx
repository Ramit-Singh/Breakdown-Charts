import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import GridLayout, { WidthProvider } from 'react-grid-layout/legacy'
import ChartErrorBoundary from './components/ChartErrorBoundary'
import FilterPanel from './components/FilterPanel'
import RadialChart from './components/RadialChart'
import {
  SELLER_FILTERS,
  getFilteredSellerSegments,
  getFilteredTotal,
  getTrafficBreakdown,
  getVisibleSellers,
  type SellerFilter,
  type SellerSegment,
  type TrafficSegment,
} from './data'
import 'react-grid-layout/css/styles.css'
import './styles/app.css'

const AutoWidthGridLayout = WidthProvider(GridLayout)

const STORAGE_KEY_V3 = 'amazon-revenue-layout-v3'
const GRID_COLUMNS = 12
const GRID_ROW_HEIGHT = 16
const GRID_MARGIN: [number, number] = [10, 10]
const GRID_CONTAINER_PADDING: [number, number] = [10, 10]

type WidgetType = 'revenueHalfMoon'

interface WidgetLayoutDefinition {
  x: number
  y: number
  w: number
  h: number
}

interface WidgetDefinition {
  title: string
  layout: WidgetLayoutDefinition
}

interface LayoutItem extends WidgetLayoutDefinition {
  id: string
  type: WidgetType
}

interface GridLayoutItem {
  i: string
  x: number
  y: number
  w: number
  h: number
}

interface WidgetContext {
  sellerFilter: SellerFilter
  filteredTotal: number
  sellerSegments: SellerSegment[]
  trafficBreakdown: TrafficSegment[]
  onSellerChange: (filter: SellerFilter) => void
  isEditMode: boolean
}

type ScaffoldStyle = CSSProperties & {
  '--grid-columns': string
  '--grid-row-height': string
  '--grid-gap-x': string
  '--grid-gap-y': string
  '--grid-pad-x': string
  '--grid-pad-y': string
}

const WIDGET_TYPE: WidgetType = 'revenueHalfMoon'

const WIDGET_LIBRARY: Record<WidgetType, WidgetDefinition> = {
  [WIDGET_TYPE]: {
    title: 'Revenue Half-Moon',
    layout: { x: 0, y: 0, w: 5, h: 20 },
  },
}

const DEFAULT_WIDGET_ORDER: WidgetType[] = [WIDGET_TYPE]

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

function sortLayoutItems(layoutItems: LayoutItem[]): LayoutItem[] {
  return [...layoutItems].sort((a, b) => a.y - b.y || a.x - b.x)
}

function cloneLayoutItems(layoutItems: LayoutItem[]): LayoutItem[] {
  return layoutItems.map((item) => ({ ...item }))
}

function enforceFixedWidgetDimensions(layoutItems: LayoutItem[]): LayoutItem[] {
  if (!Array.isArray(layoutItems) || layoutItems.length === 0) return layoutItems

  let hasChange = false

  const normalized = layoutItems
    .map((item) => {
      if (!item || item.type !== WIDGET_TYPE) {
        hasChange = true
        return null
      }

      const widgetMeta = WIDGET_LIBRARY[WIDGET_TYPE]
      const width = widgetMeta.layout.w
      const height = widgetMeta.layout.h
      const nextX = clamp(item.x, 0, Math.max(0, GRID_COLUMNS - width))
      const nextY = Math.max(0, Number.isFinite(item.y) ? item.y : widgetMeta.layout.y)
      const nextId = item.id || WIDGET_TYPE

      if (
        item.w !== width ||
        item.h !== height ||
        item.x !== nextX ||
        item.y !== nextY ||
        item.id !== nextId
      ) {
        hasChange = true
        return { ...item, id: nextId, x: nextX, y: nextY, w: width, h: height }
      }

      return item
    })
    .filter((item): item is LayoutItem => Boolean(item))

  return hasChange ? sortLayoutItems(normalized) : layoutItems
}

function getDefaultLayoutItems(): LayoutItem[] {
  return DEFAULT_WIDGET_ORDER.map((type) => ({
    id: type,
    type,
    ...WIDGET_LIBRARY[type].layout,
  }))
}

function loadInitialLayout(): LayoutItem[] {
  if (typeof window === 'undefined') return getDefaultLayoutItems()

  try {
    const storedRaw = window.localStorage.getItem(STORAGE_KEY_V3)
    if (!storedRaw) return getDefaultLayoutItems()

    const parsed: unknown = JSON.parse(storedRaw)
    if (!Array.isArray(parsed)) return getDefaultLayoutItems()

    const normalized = parsed
      .map((item): LayoutItem | null => {
        if (!isRecord(item)) return null

        const itemType = typeof item.type === 'string' ? item.type : ''
        if (itemType !== WIDGET_TYPE) return null

        const widgetMeta = WIDGET_LIBRARY[WIDGET_TYPE]
        const width = widgetMeta.layout.w
        const height = widgetMeta.layout.h
        const xValue = Number(item.x)
        const yValue = Number(item.y)

        return {
          id: WIDGET_TYPE,
          type: WIDGET_TYPE,
          x: clamp(
            Number.isFinite(xValue) ? Math.floor(xValue) : widgetMeta.layout.x,
            0,
            Math.max(0, GRID_COLUMNS - width),
          ),
          y: Math.max(0, Number.isFinite(yValue) ? Math.floor(yValue) : widgetMeta.layout.y),
          w: width,
          h: height,
        }
      })
      .filter((item): item is LayoutItem => Boolean(item))

    return normalized.length ? normalized : getDefaultLayoutItems()
  } catch {
    return getDefaultLayoutItems()
  }
}

function getStoragePayload(layoutItems: LayoutItem[]): Array<Pick<LayoutItem, 'id' | 'type' | 'x' | 'y' | 'w' | 'h'>> {
  return layoutItems.map(({ id, type, x, y, w, h }) => ({ id, type, x, y, w, h }))
}

function PencilIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="icon-svg" focusable="false">
      <path d="M4 16.25V20h3.75L19.81 7.94l-3.75-3.75L4 16.25z" fill="currentColor" />
      <path
        d="M20.71 6.04a1 1 0 000-1.41l-1.34-1.34a1 1 0 00-1.41 0l-1.04 1.04 3.75 3.75 1.04-1z"
        fill="currentColor"
      />
    </svg>
  )
}

function renderRevenueWidget(context: WidgetContext) {
  const {
    sellerFilter,
    filteredTotal,
    sellerSegments,
    trafficBreakdown,
    onSellerChange,
    isEditMode,
  } = context

  return (
    <div className="half-moon-widget">
      <div className="half-moon-widget__filters widget-no-drag">
        <FilterPanel sellerFilter={sellerFilter} onSellerChange={onSellerChange} />
      </div>
      <div className="half-moon-widget__chart">
        <ChartErrorBoundary>
          <RadialChart
            sellerSegments={sellerSegments}
            trafficBreakdown={trafficBreakdown}
            filteredTotal={filteredTotal}
            isInteractive={!isEditMode}
            animationKey={sellerFilter}
          />
        </ChartErrorBoundary>
      </div>
    </div>
  )
}

function App() {
  const [sellerFilter, setSellerFilter] = useState<SellerFilter>(SELLER_FILTERS.ALL)
  const [isEditMode, setIsEditMode] = useState(false)
  const [savedLayoutItems, setSavedLayoutItems] = useState<LayoutItem[]>(() =>
    enforceFixedWidgetDimensions(loadInitialLayout()),
  )
  const [draftLayoutItems, setDraftLayoutItems] = useState<LayoutItem[] | null>(null)
  const [isGridDragging, setIsGridDragging] = useState(false)
  const [gridWidth, setGridWidth] = useState(0)

  const activeLayoutItems = useMemo<LayoutItem[]>(
    () =>
      enforceFixedWidgetDimensions(
        isEditMode ? draftLayoutItems ?? savedLayoutItems : savedLayoutItems,
      ),
    [draftLayoutItems, isEditMode, savedLayoutItems],
  )

  const activeSellerKeys = useMemo(() => getVisibleSellers(sellerFilter), [sellerFilter])
  const filteredTotal = useMemo(() => getFilteredTotal(activeSellerKeys), [activeSellerKeys])
  const sellerSegments = useMemo(() => getFilteredSellerSegments(activeSellerKeys), [activeSellerKeys])
  const trafficBreakdown = useMemo(() => getTrafficBreakdown(activeSellerKeys), [activeSellerKeys])

  const layout = useMemo<GridLayoutItem[]>(
    () => activeLayoutItems.map(({ id, x, y, w, h }) => ({ i: id, x, y, w, h })),
    [activeLayoutItems],
  )

  const widgetContext = useMemo<WidgetContext>(
    () => ({
      sellerFilter,
      filteredTotal,
      sellerSegments,
      trafficBreakdown,
      onSellerChange: setSellerFilter,
      isEditMode,
    }),
    [sellerFilter, filteredTotal, sellerSegments, trafficBreakdown, isEditMode],
  )

  const scaffoldRowCount = useMemo(() => {
    const maxY = activeLayoutItems.reduce((highest, item) => Math.max(highest, item.y + item.h), 0)
    return Math.max(1, maxY)
  }, [activeLayoutItems])

  const showSlotScaffold = isEditMode && isGridDragging
  const scaffoldColumnWidth = useMemo(() => {
    if (!gridWidth) return null
    const usableWidth =
      gridWidth - GRID_CONTAINER_PADDING[0] * 2 - GRID_MARGIN[0] * (GRID_COLUMNS - 1)
    return usableWidth > 0 ? usableWidth / GRID_COLUMNS : null
  }, [gridWidth])

  const scaffoldStyle = useMemo<ScaffoldStyle>(
    () => ({
      '--grid-columns': String(GRID_COLUMNS),
      '--grid-row-height': `${GRID_ROW_HEIGHT}px`,
      '--grid-gap-x': `${GRID_MARGIN[0]}px`,
      '--grid-gap-y': `${GRID_MARGIN[1]}px`,
      '--grid-pad-x': `${GRID_CONTAINER_PADDING[0]}px`,
      '--grid-pad-y': `${GRID_CONTAINER_PADDING[1]}px`,
      ...(scaffoldColumnWidth
        ? { gridTemplateColumns: `repeat(${GRID_COLUMNS}, ${scaffoldColumnWidth}px)` }
        : {}),
    }),
    [scaffoldColumnWidth],
  )

  const handleGridWidthChange = useCallback((width: number) => {
    if (width > 0) setGridWidth(width)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY_V3, JSON.stringify(getStoragePayload(savedLayoutItems)))
  }, [savedLayoutItems])

  const syncLayoutFromGrid = useCallback(
    (nextLayout: GridLayoutItem[]) => {
      if (!isEditMode) return

      setDraftLayoutItems((currentItems) => {
        if (!currentItems?.length) return currentItems

        const byId = new Map(nextLayout.map((item) => [item.i, item]))
        let hasChange = false

        const nextItems = currentItems.map((existingItem) => {
          const layoutItem = byId.get(existingItem.id)
          if (!layoutItem) return existingItem

          const widgetMeta = WIDGET_LIBRARY[WIDGET_TYPE]
          const fixedWidth = widgetMeta.layout.w
          const nextX = clamp(layoutItem.x, 0, Math.max(0, GRID_COLUMNS - fixedWidth))
          const nextY = Math.max(0, layoutItem.y)

          if (nextX !== existingItem.x || nextY !== existingItem.y) hasChange = true

          return { ...existingItem, x: nextX, y: nextY }
        })

        return hasChange ? sortLayoutItems(nextItems) : currentItems
      })
    },
    [isEditMode],
  )

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
          <h1 className="header-text">Analytics</h1>
        </div>

        <div className="analytics-header__actions">
          {!isEditMode && (
            <button className="action-btn action-btn--edit" onClick={startLayoutEdit} type="button">
              <PencilIcon />
              Edit Layout
            </button>
          )}
          {isEditMode && (
            <>
              <button className="action-btn action-btn--edit is-active" onClick={saveLayoutEdit} type="button">
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
          <div className={`dashboard-grid-shell ${showSlotScaffold ? 'is-guided' : ''}`}>
            <div
              aria-hidden="true"
              className={`slot-scaffold ${showSlotScaffold ? 'is-visible' : ''}`}
              style={scaffoldStyle}
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
              onDragStop={(nextLayout: GridLayoutItem[]) => {
                syncLayoutFromGrid(nextLayout)
                setIsGridDragging(false)
              }}
              onLayoutChange={syncLayoutFromGrid}
              onWidthChange={handleGridWidthChange}
              preventCollision={false}
              rowHeight={GRID_ROW_HEIGHT}
              useCSSTransforms={false}
            >
              {activeLayoutItems.map((widget) => {
                const widgetMeta = WIDGET_LIBRARY[widget.type]
                if (!widgetMeta) return null

                return (
                  <div className="widget-grid-item" key={widget.id}>
                    <article className={`widget-card widget-card--${widget.type} ${isEditMode ? 'is-editing' : ''}`}>
                      <header className="widget-card__header">
                        <h3>{widgetMeta.title}</h3>
                      </header>
                      <div className={`widget-card__body widget-card__body--${widget.type}`}>
                        <div className={`widget-content-probe widget-content-probe--${widget.type}`}>
                          {renderRevenueWidget(widgetContext)}
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
