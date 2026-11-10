import { Component, lazy, Suspense, useEffect, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Emblem } from './components/brand';
import { CelebrationHost, ConfirmHost, ToastHost } from './components/overlays';
import { Shell } from './components/Shell';
import { Button } from './components/ui';
import { useRoute } from './lib/router';
import { useStore } from './store/tournament';
import Home from './sections/Home';

const Draw = lazy(() => import('./sections/Draw'));
const Groups = lazy(() => import('./sections/Groups'));
const Knockout = lazy(() => import('./sections/Knockout'));
const Road = lazy(() => import('./sections/Road'));
const Stats = lazy(() => import('./sections/Stats'));
const Recap = lazy(() => import('./sections/Recap'));
const Poster = lazy(() => import('./sections/Poster'));
const Settings = lazy(() => import('./sections/Settings'));

class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (this.state.error)
      return (
        <div className="glass mx-auto mt-10 max-w-lg rounded-2xl p-8 text-center">
          <h2 className="font-display text-2xl uppercase">Algo salió mal</h2>
          <p className="mt-2 text-sm text-white/60">{this.state.error.message}</p>
          <Button className="mt-5" variant="gold" onClick={() => this.setState({ error: null })}>
            Reintentar
          </Button>
        </div>
      );
    return this.props.children;
  }
}

function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2.4, ease: 'linear' }}>
        <Emblem size={56} />
      </motion.div>
    </div>
  );
}

export default function App() {
  const ready = useStore((s) => s.ready);
  const init = useStore((s) => s.init);
  const route = useRoute();
  useEffect(() => {
    void init();
  }, [init]);

  if (!ready)
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-night-950">
        <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ repeat: Infinity, duration: 1.6 }}>
          <Emblem size={84} />
        </motion.div>
        <div className="font-cond text-sm font-bold uppercase tracking-[0.4em] text-white/50">Entrando al estadio…</div>
      </div>
    );

  const page = (() => {
    switch (route.section) {
      case 'draw':
        return <Draw />;
      case 'groups':
        return <Groups param={route.param} />;
      case 'knockout':
        return <Knockout />;
      case 'road':
        return <Road param={route.param} />;
      case 'stats':
        return <Stats />;
      case 'recap':
        return <Recap param={route.param} />;
      case 'poster':
        return <Poster param={route.param} />;
      case 'settings':
        return <Settings />;
      default:
        return <Home />;
    }
  })();

  return (
    <>
      <Shell section={route.section}>
        <ErrorBoundary resetKey={route.section}>
          <Suspense fallback={<Loading />}>
            <motion.div key={route.section + (route.param ?? '')} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}>
              {page}
            </motion.div>
          </Suspense>
        </ErrorBoundary>
      </Shell>
      <ConfirmHost />
      <ToastHost />
      <CelebrationHost />
    </>
  );
}
