import { Component, type ReactNode } from 'react';

export class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-shell">
          <section className="app-panel" aria-labelledby="app-error-title">
            <h1 id="app-error-title">zäme konnte nicht geladen werden</h1>
            <p>Versuche, die Seite neu zu laden.</p>
            <button type="button" onClick={() => window.location.reload()}>
              Seite neu laden
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
