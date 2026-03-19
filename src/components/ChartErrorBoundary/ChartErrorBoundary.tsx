import { Component, type ReactNode } from 'react'
import './ChartErrorBoundary.css'

interface ChartErrorBoundaryProps {
  children: ReactNode
}

interface ChartErrorBoundaryState {
  hasError: boolean
  message: string
}

class ChartErrorBoundary extends Component<ChartErrorBoundaryProps, ChartErrorBoundaryState> {
  constructor(props: ChartErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: unknown): ChartErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Unknown chart error',
    }
  }

  componentDidCatch(error: unknown): void {
    // eslint-disable-next-line no-console
    console.error('Chart render failed:', error)
  }

  render(): ReactNode {
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

