# Breakdown Charts Dashboard

Interactive analytics dashboard built with React, `react-grid-layout`, and AG Charts.

## What this project does

1. Renders a dashboard of analytics widgets in a 12-column grid.
2. Supports drag-only layout editing with Save/Cancel workflow.
3. Persists committed layout to localStorage.
4. Embeds filters inside the Revenue Half-Moon card and updates all widgets from shared filter state.
5. Uses layered donut series in AG Charts to create a half-moon revenue visualization.

## Scripts

1. `npm run dev` - run local dev server.
2. `npm run build` - production build.
3. `npm run lint` - eslint checks.
4. `npm run preview` - preview production build.

## Code-level documentation

For a full implementation walkthrough (state model, component logic, data flow, dependencies, grid behavior, and chart internals), see:

[Code-Level Walkthrough](./docs/CODE_LEVEL_WALKTHROUGH.md)
