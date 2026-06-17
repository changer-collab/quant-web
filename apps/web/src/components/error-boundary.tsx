import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div
          role="alert"
          style={{
            padding: '2rem',
            margin: '2rem',
            borderRadius: '8px',
            background: '#1a0a0a',
            border: '1px solid #ff4444',
            color: '#ff8888',
          }}
        >
          <h2 style={{ margin: '0 0 0.5rem', color: '#ff6666' }}>Something went wrong</h2>
          <p style={{ margin: '0 0 1rem', color: '#cc8888' }}>
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              border: '1px solid #ff6666',
              background: 'transparent',
              color: '#ff8888',
              cursor: 'pointer',
            }}
            type="button"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
