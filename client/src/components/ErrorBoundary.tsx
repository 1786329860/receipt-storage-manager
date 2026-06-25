import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetail: boolean;
}

// 捕获子组件渲染错误，防止整个应用白屏，并显示具体错误便于排查
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, showDetail: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('应用渲染错误:', error, info);
    // 持久化错误信息，方便用户反馈
    try {
      localStorage.setItem('last_render_error', JSON.stringify({
        message: error.message,
        stack: error.stack,
        componentStack: info.componentStack,
        time: new Date().toISOString(),
      }));
    } catch {
      // localStorage 不可用时忽略
    }
    this.setState({ errorInfo: info });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetail: false });
  };

  handleReload = () => {
    window.location.reload();
  };

  toggleDetail = () => {
    this.setState((prev) => ({ showDetail: !prev.showDetail }));
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, showDetail } = this.state;
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6 py-8">
          <div className="text-center max-w-md w-full">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-slate-900 mb-2">应用出错了</h1>
            <p className="text-sm text-slate-500 mb-2">
              页面渲染遇到问题，可以尝试重试或重新加载应用。
            </p>
            {error && (
              <p className="text-xs text-red-500 mb-4 break-all">
                {error.message}
              </p>
            )}
            <div className="flex gap-3 justify-center mb-4">
              <button
                onClick={this.handleReset}
                className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium active:bg-slate-50"
              >
                重试
              </button>
              <button
                onClick={this.handleReload}
                className="px-5 py-2.5 bg-primary-600 text-white rounded-xl font-medium active:bg-primary-700"
              >
                重新加载
              </button>
            </div>
            <button
              onClick={this.toggleDetail}
              className="text-xs text-slate-400 underline"
            >
              {showDetail ? '隐藏详情' : '查看错误详情'}
            </button>
            {showDetail && (
              <pre className="mt-3 text-left text-[10px] text-slate-500 bg-slate-100 p-3 rounded-xl overflow-auto max-h-60 whitespace-pre-wrap break-all">
                {error?.stack || '无堆栈信息'}
                {errorInfo?.componentStack && (
                  <>
                    {'\n\n--- 组件堆栈 ---\n'}
                    {errorInfo.componentStack}
                  </>
                )}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
