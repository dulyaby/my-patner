import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
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
        <div className="min-h-screen flex items-center justify-center bg-white p-6">
          <div className="apple-card p-10 max-w-lg text-center shadow-2xl">
            <div className="w-20 h-20 bg-[#FF3B30]/10 rounded-3xl flex items-center justify-center text-[#FF3B30] mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            </div>
            <h1 className="text-2xl font-black text-black mb-4">Mfumo Imekwama kidogo</h1>
            <p className="text-gray-600 mb-8 font-medium">Kuna tatizo la kiufundi limejitokeza. Tafadhali jaribu kufungua upya app.</p>
            <div className="p-4 bg-black/[0.03] rounded-2xl text-left overflow-auto max-h-40">
              <code className="text-xs text-[#FF3B30] whitespace-pre-wrap">
                {this.state.error?.toString()}
              </code>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="mt-8 apple-button-primary w-full"
            >
              Jaribu Tena
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
