import {
  FILTER_OPTIONS,
  SELLER_FILTERS,
  type FilterOption,
  type SellerFilter,
} from '../../data'
import './FilterPanel.css'

interface FilterPanelProps {
  sellerFilter: SellerFilter
  onSellerChange: (filter: SellerFilter) => void
}

function FilterPanel({ sellerFilter, onSellerChange }: FilterPanelProps) {
  const topLevelFilters = FILTER_OPTIONS.filter(
    (opt: FilterOption) =>
      opt.key === SELLER_FILTERS.ALL ||
      opt.key === SELLER_FILTERS.ONE_P ||
      opt.key === SELLER_FILTERS.THREE_P,
  )

  const is3PContext =
    sellerFilter === SELLER_FILTERS.THREE_P ||
    sellerFilter === SELLER_FILTERS.FBA ||
    sellerFilter === SELLER_FILTERS.MFN

  const breakdownOptions: Array<{ key: SellerFilter; label: string }> = [
    { key: SELLER_FILTERS.THREE_P, label: 'All' },
    { key: SELLER_FILTERS.FBA, label: 'FBA' },
    { key: SELLER_FILTERS.MFN, label: 'MFN' },
  ]

  return (
    <div className="filter-panel-v2">
      <h3 className="filter-panel-v2__title">Filters</h3>

      <div className="filter-row">
        <div className="filter-group">
          <div className="filter-pills">
            {topLevelFilters.map((opt) => {
              const isActive =
                opt.key === sellerFilter ||
                (opt.key === SELLER_FILTERS.THREE_P && is3PContext)

              return (
                <button
                  key={opt.key}
                  type="button"
                  className={`filter-pill ${isActive ? 'filter-pill--active' : ''}`}
                  onClick={() => onSellerChange(opt.key)}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {is3PContext && (
          <div className="filter-group filter-group--breakdown">
            <span className="filter-group__label">3P Breakdown</span>
            <div className="filter-radios">
              {breakdownOptions.map((opt) => (
                <label key={opt.key} className="filter-radio">
                  <input
                    type="radio"
                    name="3p-breakdown"
                    className="filter-radio__input"
                    checked={sellerFilter === opt.key}
                    onChange={() => onSellerChange(opt.key)}
                  />
                  <span className="filter-radio__label">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default FilterPanel


