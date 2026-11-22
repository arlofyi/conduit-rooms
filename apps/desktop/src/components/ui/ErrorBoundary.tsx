import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./Button";
import { Notice } from "./Notice";

interface ErrorBoundaryProps {
  /** What failed, in words for the screen: "the sidebar", "this conversation". */
  name: string;
  /** When this value changes, the boundary clears its error and tries again. */
  resetKey?: unknown;
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Stops a rendering error in one region from blanking the whole window.
 * Each region of the shell sits in its own boundary, so a broken message
 * row costs you that conversation's panel and nothing else.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[rooms] ${this.props.name} crashed:`, error, info.componentStack);
  }

  override componentDidUpdate(previous: ErrorBoundaryProps): void {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex h-full items-center justify-center p-6">
        <Notice
          tone="error"
          className="max-w-md"
          actions={
            <Button size="sm" onClick={() => this.setState({ error: null })}>
              Try again
            </Button>
          }
        >
          Something went wrong showing {this.props.name}.
        </Notice>
      </div>
    );
  }
}
