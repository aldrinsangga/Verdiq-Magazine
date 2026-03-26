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
    
    // Check if it's a dynamic import failure (common after a new deployment)
    const isChunkLoadError = error.name === 'ChunkLoadError' || 
                             error.message.includes('Failed to fetch dynamically imported module') ||
                             error.message.includes('Importing a module script failed');
                             
    if (isChunkLoadError) {
      const lastReload = localStorage.getItem('last-chunk-reload');
      const now = Date.now();
      
      // Only reload if we haven't reloaded in the last 10 seconds to avoid infinite loops
      if (!lastReload || now - parseInt(lastReload) > 10000) {
        localStorage.setItem('last-chunk-reload', now.toString());
        console.warn('Dynamic import failed. Reloading page to fetch latest version...');
        window.location.reload();
      }
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
          <div className="max-w-md w-full glass p-8 rounded-[40px] border border-slate-800 text-center">
            <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <TriangleAlert className="w-10 h-10 text-rose-500" />
            </div>
            <h2 className="text-2xl font-black text-white mb-4 tracking-tighter">
              {this.state.error?.message.includes('Failed to fetch dynamically imported module') 
                ? "New version available" 
                : (this.state.error?.message.includes('QUOTA_EXCEEDED') 
                    ? "Temporary Limit Reached" 
                    : "Something went wrong")}
            </h2>
            <p className="text-slate-400 mb-8 text-sm leading-relaxed">
              {this.state.error?.message.includes('Failed to fetch dynamically imported module')
                ? "A new version of the application has been deployed. We need to reload to get the latest updates."
                : (this.state.error?.message.includes('QUOTA_EXCEEDED')
                    ? "The application is currently experiencing high traffic and has reached its temporary database limit. This is a temporary limit that resets daily."
                    : "An unexpected error occurred in the application. We've been notified and are working to fix it.")}
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
