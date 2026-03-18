# Code-Level Walkthrough

This document explains exactly how the dashboard is implemented so you can explain the project and every major feature confidently at coding level.

## 1) High-level architecture

1. Entry point is `src/main.jsx`.
2. App orchestration, grid state, edit workflow, and widget rendering live in `src/App.jsx`.
3. Data model, filtering selectors, and formatters live in `src/data.js`.
4. UI components:
   - `src/components/FilterPanel.jsx`
   - `src/components/RadialChart.jsx`
   - `src/components/ChartErrorBoundary.jsx`
5. Styling and layout behavior are in `src/styles/app.css`.

## 2) Runtime and dependencies

Dependencies from `package.json` and what each one is used for:

1. `react`, `react-dom`
   - Component rendering and state management.
2. `react-grid-layout`
   - Drag-and-reflow dashboard grid engine.
3. `ag-charts-react`, `ag-charts-community`, `ag-charts-enterprise`
   - Chart rendering for the half-moon radial visualization.
4. `react-resizable`
   - Grid ecosystem dependency. UI resize is disabled in this project.
5. `vite`
   - Development server and production bundling.
6. `eslint` and plugins
   - Static analysis and hook correctness checks.

In `src/main.jsx`, AG enterprise features are initialized once:

```jsx
AgChartsEnterpriseModule.setup()
```

## 3) Data model and selector pipeline

All business data logic is centralized in `src/data.js`.

1. `RAW_DATA`
   - Source numbers per seller channel (`1P`, `FBA`, `MFN`), split by `ADS` and `Organic`.
2. `SELLER_FILTERS`
   - Canonical filter keys (`All`, `1P`, `3P`, `FBA`, `MFN`).
3. `FILTER_SETS`
   - Mapping from filter key to visible seller keys.
4. `FILTER_OPTIONS`
   - Filter metadata for UI (label and computed total).
5. Selector functions:
   - `getVisibleSellers(filterKey)`
   - `getFilteredTotal(activeSellerKeys)`
   - `getTrafficBreakdown(activeSellerKeys)`
   - `getFilteredSellerSegments(activeSellerKeys)`
6. Formatting helpers:
   - `formatCurrency(value)`
   - `formatPercent(value)`

Why this matters:

1. Components render from derived data only.
2. Filter logic is pure and reusable.
3. There is one source of truth for totals and percentages.

## 4) Grid and layout engine design

### 4.1 Layout metadata

In `src/App.jsx`:

1. `WIDGET_LIBRARY`
   - Defines each widget type and default `x, y, w, h`.
2. `DEFAULT_WIDGET_ORDER`
   - Defines which widgets exist and in what initial order.
3. Grid constants:
   - `GRID_COLUMNS = 12`
   - `GRID_ROW_HEIGHT = 16`
   - `GRID_MARGIN = [10, 10]`
   - `GRID_CONTAINER_PADDING = [0, 0]`

### 4.2 Persisted layout contract

Storage key: `amazon-revenue-layout-v3`.

Persisted shape:

```js
[{ id, type, x, y, w, h }]
```

How it is handled:

1. `loadInitialLayout()`
   - Parses localStorage.
   - Rejects invalid entries.
   - Drops unknown widget types.
   - Coerces numeric coordinates safely.
   - Removes duplicate IDs.
   - Falls back to defaults.
2. `getStoragePayload(layoutItems)`
   - Normalizes what gets written to localStorage.

### 4.3 Fixed-size policy

`enforceFixedWidgetDimensions(layoutItems)` keeps widget sizes canonical by type:

1. Rewrites `w` and `h` from `WIDGET_LIBRARY`.
2. Clamps `x` so cards cannot overflow right boundary.
3. Drops stale widget types from older layouts.

This is why users can move cards but cannot resize them.

## 5) Edit mode workflow (Save/Cancel draft model)

`src/App.jsx` uses separate committed and draft states:

1. `savedLayoutItems`
   - Source of truth in view mode.
2. `draftLayoutItems`
   - Temporary state in edit mode.
3. `activeLayoutItems`
   - Computed as draft when editing, saved when viewing.

User flow:

1. `startLayoutEdit()`
   - Clone saved layout into draft.
   - Enable edit mode.
2. `syncLayoutFromGrid(nextLayout)`
   - On drag events, map RGL positions back into draft items.
   - Keep x clamped.
3. `saveLayoutEdit()`
   - Normalize and commit draft into saved layout.
   - Persist via `useEffect` bound to `savedLayoutItems`.
4. `cancelLayoutEdit()`
   - Exit edit mode and drop draft changes.

Result:

1. Dragging is safe and reversible.
2. Layout changes are persisted only after Save.

## 6) Grid interaction behavior

Grid component:

```jsx
<AutoWidthGridLayout ... />
```

Key config choices:

1. `isDraggable={isEditMode}`
2. `isResizable={false}`
3. `compactType="vertical"`
4. `draggableCancel=".widget-no-drag,button,input,textarea,select,label,option"`
5. `onLayoutChange={syncLayoutFromGrid}`
6. `onDragStop={...syncLayoutFromGrid(...)}`

Why `draggableCancel` is critical:

1. Filter controls remain clickable and do not trigger drag.

Drag scaffold:

1. `isGridDragging` toggles while dragging.
2. `showSlotScaffold = isEditMode && isGridDragging`.
3. `scaffoldRowCount` is computed from max widget bottom (`max(y + h)`).
4. Dashed scaffold cells render only during drag.

## 7) Widget composition and rendering

`renderWidgetBody(widgetType, context)` is the routing layer in `src/App.jsx`.

Widgets:

1. `revenueHalfMoon`
   - Renders `FilterPanel` + `RadialChart` inside same card.
   - Wrapped with `ChartErrorBoundary`.
2. `trafficBreakdown`
   - Renders two metric rows (ADS/Organic).
3. `sellerContribution`
   - Renders progress bars by seller segment.
4. `kpiOverview`
   - Renders total revenue + ADS/Organic share cards.

The card title/header shell is rendered once in the main grid map and body content is injected per type.

## 8) Filter component internals

`src/components/FilterPanel.jsx`:

1. Top pills are restricted to `All`, `1P`, `3P`.
2. `is3PContext` is true for `3P`, `FBA`, or `MFN`.
3. Breakdown radios (`All`, `FBA`, `MFN`) render only in 3P context.
4. Clicking controls calls `onSellerChange` from App.

So FilterPanel is presentation and event emission. State ownership stays in App.

## 9) Radial chart internals

`src/components/RadialChart.jsx`:

1. `buildHalfMoonData()`
   - Appends transparent `__filler__` datum so donut appears as half-moon.
2. `makeTooltipRenderer(filteredTotal)`
   - Suppresses filler tooltip.
   - Shows revenue and percentage for real slices.
3. `commonSeries`
   - Shared donut config (`rotation`, labels, tooltip, spacing).
4. Series layering:
   - Outer ring: seller split.
   - Inner ring: ADS/Organic split.
5. Center value is rendered as HTML overlay (`.radial-center-copy`) for precise visual control.

Important behavior:

1. In edit mode, pointer interaction for charts is disabled in CSS to prioritize dragging.

## 10) Error boundary strategy

`src/components/ChartErrorBoundary.jsx` is a class component boundary:

1. Captures chart render exceptions.
2. Logs error with `componentDidCatch`.
3. Shows fallback UI instead of crashing the whole dashboard.

## 11) CSS structure and responsibilities

`src/styles/app.css` is organized by shell -> grid -> card -> widget specifics.

Major groups:

1. App shell: header, actions, spacing, typography.
2. Grid shell:
   - `.dashboard-grid-shell`
   - `.slot-scaffold` and `.slot-scaffold__cell`
   - RGL placeholder styling.
3. Card frame:
   - `.widget-card`, `.widget-card__header`, `.widget-card__body`.
4. Revenue widget:
   - `.half-moon-widget`, filter region, chart region.
   - `.radial-chart-shell`, `.radial-chart-visual`, `.chart-frame--radial`.
5. Traffic, seller contribution, KPI card styles.
6. Filter styles:
   - `.filter-row`, `.filter-group`, pills, radios.
7. Edit-mode chart interactivity suppression selectors.

## 12) Methods and coding approach used

Patterns used in implementation:

1. Hook-driven state + memoized derivations (`useState`, `useMemo`, `useCallback`, `useEffect`).
2. Immutable transforms (`map`, `filter`, `reduce`) for predictable updates.
3. Defensive normalization at I/O boundaries (layout read/write).
4. Single-source data derivation from selectors in `data.js`.
5. Separation of concerns:
   - App for orchestration.
   - Components for specific rendering concerns.
   - CSS for behavior-oriented visual layering.

## 13) Behavior guarantees (what you can confidently say)

1. Layout edits are draft-only until Save.
2. Cancel always restores last saved layout.
3. Layout persistence survives refresh via localStorage.
4. Widget sizes are fixed by type.
5. Filters drive all dependent widgets through one shared filter state.
6. Revenue filters and chart belong to one logical card.
7. Chart failures degrade gracefully through error boundaries.

## 14) Quick verbal explanation script

Use this when someone asks, "How did you build it?"

1. "We used React + react-grid-layout for a 12-column drag-only dashboard canvas."
2. "Layout state is split into saved and draft; edit mode modifies draft, Save commits, Cancel discards."
3. "We persist normalized `{id,type,x,y,w,h}` layout items in localStorage and enforce fixed widget dimensions by type."
4. "Filters are centralized in App state and drive selectors in `data.js`, so all widgets react consistently."
5. "The half-moon chart is two layered donut series in AG Charts plus a transparent filler slice to hide half the circle, with a center-value HTML overlay."
6. "We wrapped charts in an error boundary and disabled chart pointer interactions in edit mode to prioritize dragging."
