//radial charts
import { AgCharts } from 'ag-charts-react'
import { formatCurrency, formatPercent } from '../data'

function buildHalfMoonData(segments, filteredTotal, labelAccessor) {
  const visibleSegments = segments.map((segment) => ({
    ...segment,
    label: labelAccessor(segment),
    isFiller: false,
  }))

  return [
    ...visibleSegments,
    {
      key: '__filler__',
      label: '',
      longLabel: '',
      value: filteredTotal,
      color: 'rgba(255,255,255,0)',
      isFiller: true,
    },
  ]
}

function makeTooltipRenderer(filteredTotal) {
  return ({ datum }) => {
    if (
      datum.isFiller ||
      datum.key === '__filler__' ||
      datum.color === 'rgba(255,255,255,0)'
    ) {
      return { enabled: false }
    }

    return {
      title: datum.longLabel || datum.label,
      data: [
        { label: 'Revenue', value: formatCurrency(datum.value) },
        {
          label: '% of Filter',
          value: formatPercent(
            filteredTotal ? (datum.value / filteredTotal) * 100 : 0,
          ),
        },
      ],
    }
  }
}

function makeSectorLabelFormatter() {
  return ({ datum }) => (datum.isFiller ? '' : datum.label)
}

function RadialChart({
  sellerSegments,
  trafficBreakdown,
  filteredTotal,
  isInteractive = true,
}) {
  const sellerData = buildHalfMoonData(
    sellerSegments,
    filteredTotal,
    (segment) => (segment.showLabel ? segment.label : ''),
  )

  const trafficData = buildHalfMoonData(
    trafficBreakdown,
    filteredTotal,
    (segment) => segment.label,
  )

  const commonSeries = {
    rotation: -90,
    angleKey: 'value',
    calloutLabelKey: 'label',
    sectorLabelKey: 'label',
    calloutLabel: {
      enabled: false,
    },
    sectorLabel: {
      enabled: true,
      color: '#ffffff',
      fontFamily: 'Outfit, sans-serif',
      fontWeight: '600',
      fontSize: 13,
      positionRatio: 0.56,
      formatter: makeSectorLabelFormatter(),
    },
    tooltip: {
      renderer: makeTooltipRenderer(filteredTotal),
    },
    highlight: {
      highlightedItem: {
        strokeWidth: 0,
      },
      unhighlightedItem: {
        opacity: 1,
      },
    },
    strokeWidth: 0,
    sectorSpacing: 3,
  }

  const options = {
    background: { fill: 'transparent' },
    legend: { enabled: false },
    padding: { top: 0, right: 8, bottom: 0, left: 8 },
    animation: {
      enabled: false,
    },
    tooltip: isInteractive
      ? {
          class: 'ag-dashboard-tooltip',
        }
      : {
          enabled: false,
        },
    series: [
      {
        ...commonSeries,
        type: 'donut',
        data: sellerData,
        fills: sellerData.map((segment) => segment.color),
        strokes: sellerData.map((segment) =>
          segment.isFiller ? 'rgba(255,255,255,0)' : '#ffffff',
        ),
        outerRadiusRatio: 1,
        innerRadiusRatio: 0.7,
        sectorLabel: {
          ...commonSeries.sectorLabel,
          fontSize: 14,
          fontWeight: '700',
          positionRatio: 0.54,
        },
      },
      {
        ...commonSeries,
        type: 'donut',
        data: trafficData,
        fills: trafficData.map((segment) => segment.color),
        strokes: trafficData.map((segment) =>
          segment.isFiller ? 'rgba(255,255,255,0)' : 'rgba(255, 255, 255, 0.4)',
        ),
        outerRadiusRatio: 0.6,
        innerRadiusRatio: 0.38,
        sectorLabel: {
          ...commonSeries.sectorLabel,
          fontSize: 11,
          fontWeight: '600',
          positionRatio: 0.58,
        },
      },
    ],
  }

  return (
    <div className="radial-chart-shell">
      <div className="radial-chart-visual">
        <AgCharts options={options} className="chart-frame chart-frame--radial" />
        <div className="radial-center-copy">
          <p className="radial-total">{formatCurrency(filteredTotal)}</p>
        </div>
      </div>
    </div>
  )
}

export default RadialChart

