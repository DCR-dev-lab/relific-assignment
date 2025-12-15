import React from "react";

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <p style={{ padding: "20px", color: "#991b1b" }}>
          Something went wrong. Please refresh the page.
        </p>
      );
    }
    return this.props.children;
  }
}
