import React from 'react';

interface Props { children: React.ReactNode; fallback?: React.ReactNode; }
interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center justify-center min-h-[200px] p-8" role="alert">
          <div className="text-center max-w-md">
            <div className="w-14 h-14 mx-auto mb-4 bg-error-light rounded-full flex items-center justify-center">
              <svg className="w-7 h-7 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-800">Algo salio mal</h3>
            <p className="text-sm text-slate-500 mt-1">Hubo un error inesperado. Intenta recargar la pagina.</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="mt-4 px-6 py-2 bg-gradient-to-r from-accent-light to-accent text-white rounded-button text-sm hover:from-accent hover:to-accent-dark transition-all"
            >
              Intentar de nuevo
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
