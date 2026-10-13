import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// Nothing in this app ever caught a render-time error before this - any
// uncaught exception anywhere in the tree unmounted React entirely, leaving
// a blank white page with no way back short of knowing to open DevTools and
// hard-refresh. This is the last line of defense for that: whatever broke,
// show a real message and a way to recover instead of nothing at all.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught render error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-sky-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-sky-100 bg-white p-6 text-center shadow-[0_8px_30px_rgba(56,189,248,0.15)] md:p-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-lg font-bold text-white">
            CH
          </div>
          <h1 className="mb-2 text-xl font-bold text-gray-900">Something went wrong</h1>
          <p className="mb-6 text-sm leading-6 text-gray-600">
            This page hit an unexpected error. Reloading usually fixes it — especially right after the app's been updated.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-sky-500/30 hover:shadow-lg"
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
