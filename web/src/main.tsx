import { Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

class GameBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override componentDidCatch(error: Error) { console.error('Three White Lights failed to render:', error.message); }
  override render() {
    if (this.state.failed) return <div className="fatal-screen"><div className="brand-lights"><i /><i /><i /></div><h1>The gym could not open.</h1><p>Reload to reconnect to your account. Saved progress stays on the server.</p><button className="primary" onClick={() => location.reload()}>Reload gym</button></div>;
    return this.props.children;
  }
}
const container = document.getElementById('root');
if (!container) throw new Error('Missing application mount');
createRoot(container).render(<GameBoundary><App /></GameBoundary>);
