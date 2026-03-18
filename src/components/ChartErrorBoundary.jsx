import { Component } from 'react'

class ChartErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Unknown chart error',
    }
  }

  componentDidCatch(error) {
    console.error('Chart render failed:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="chart-error-state">
          <p className="chart-error-state__title">Chart failed to render</p>
          <p className="chart-error-state__body">{this.state.message}</p>
        </div>
      )
    }

    return this.props.children
  }
}

export default ChartErrorBoundary
