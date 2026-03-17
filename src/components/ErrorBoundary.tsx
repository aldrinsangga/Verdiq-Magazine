import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
    
    // Log to your error reporting service here
    try {
      const errorDetails = {
        error: error.toString(),
        componentStack: errorInfo.componentStack,
        url: window.location.href,
        timestamp: new Date().toISOString()
      };
      console.error('Detailed Error Report:', JSON.stringify(errorDetails));
    } catch (e) {
      // Ignore logging errors
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    try {
      window.location.href = '/';
    } catch (e) {
      console.error('Reset failed:', e);
    }
  };

  private handleReload = () => {
    try {
      window.location.reload();
    } catch (e) {
      console.error('Reload failed:', e);
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-neutral-900 border border-white/10 rounded-2xl p-8 text-center shadow-2xl">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="text-red-500 w-8 h-8" />
            </div>
            
            <h1 className="text-2xl font-bold text-white mb-3">Something went wrong</h1>
            <p className="text-neutral-400 mb-8 leading-relaxed">
              We encountered an unexpected error. This might be a temporary connection issue or a glitch in the studio.
            </p>

            {this.state.error && (
              <div className="mb-8 p-4 bg-black/40 rounded-xl border border-white/5 text-left overflow-hidden">
                <p className="text-xs font-mono text-red-400 break-words">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all border border-white/10 font-medium"
              >
                <RefreshCcw size={18} />
                <span>Retry</span>
              </button>
              <button
                onClick={this.handleReset}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-black hover:bg-neutral-200 rounded-xl transition-all font-medium"
              >
                <Home size={18} />
                <span>Home</span>
              </button>
            </div>
            
            <p className="mt-8 text-xs text-neutral-600">
              If this persists, please contact support with the error details above.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
