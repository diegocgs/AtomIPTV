import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100vh',
              background: '#0a0b0f',
              color: '#f2f4f8',
              gap: '1.5rem',
              fontFamily: 'system-ui, sans-serif',
              textAlign: 'center',
              padding: '2rem',
            }}
          >
            <p style={{ fontSize: '1.4rem', opacity: 0.8 }}>
              Ocorreu um erro inesperado.{' '}
              <strong style={{ color: '#5b8cff' }}>Prima Voltar</strong> para regressar.
            </p>
            {import.meta.env.DEV && (
              <pre
                style={{
                  fontSize: '0.75rem',
                  opacity: 0.5,
                  maxWidth: '80vw',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {this.state.error?.message}
              </pre>
            )}
          </div>
        )
      )
    }
    return this.props.children
  }
}
