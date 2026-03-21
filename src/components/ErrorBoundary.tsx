import React, { Component, ErrorInfo, ReactNode } from 'react';
import { TriangleAlert, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
          <div className="max-w-md w-full glass p-8 rounded-[40px] border border-slate-800 text-center">
            <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <TriangleAlert className="w-10 h-10 text-rose-500" />
            </div>
            <h2 className="text-2xl font-black text-white mb-4 tracking-tighter">Something went wrong</h2>
            <p className="text-slate-400 mb-8 text-sm leading-relaxed">
              An unexpected error occurred in the application. We've been notified and are working to fix it.
            </p>
            {this.state.error && (
              <div className="bg-slate-900/50 rounded-2xl p-4 mb-8 text-left overflow-auto max-h-32 border border-slate-800">
                <code className="text-[10px] text-rose-400 font-mono">
                  {this.state.error.toString()}
                </code>
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-white text-slate-950 font-black py-4 rounded-2xl transition-all hover:bg-slate-200 flex items-center justify-center gap-2 text-sm uppercase tracking-widest"
            >
              <RefreshCcw className="w-4 h-4" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
