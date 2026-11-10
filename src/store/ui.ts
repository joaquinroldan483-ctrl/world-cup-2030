import { create } from 'zustand';
import type { KnockoutStage } from '../engine';

export interface ConfirmRequest {
  id: number;
  title: string;
  message: string;
  details?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  title: string;
  message?: string;
  teamIds?: string[];
}

export type Celebration =
  | { kind: 'match'; matchId: string }
  | { kind: 'qualified'; teamIds: string[] }
  | { kind: 'phase'; stage: KnockoutStage | 'GROUPS_DONE' }
  | { kind: 'champion'; teamId: string };

interface UIState {
  confirmReq: ConfirmRequest | null;
  toasts: Toast[];
  celebrations: Celebration[];
  moreOpen: boolean;
  setMoreOpen: (v: boolean) => void;
  pushToast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
  pushCelebrations: (c: Celebration[]) => void;
  shiftCelebration: () => void;
}

let seq = 1;

export const useUI = create<UIState>((setState) => ({
  confirmReq: null,
  toasts: [],
  celebrations: [],
  moreOpen: false,
  setMoreOpen: (v) => setState({ moreOpen: v }),
  pushToast: (t) => {
    const id = seq++;
    setState((s) => ({ toasts: [...s.toasts, { ...t, id }].slice(-4) }));
    setTimeout(() => setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), t.kind === 'error' ? 6500 : 4200);
  },
  dismissToast: (id) => setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  pushCelebrations: (c) => setState((s) => ({ celebrations: [...s.celebrations, ...c].slice(0, 6) })),
  shiftCelebration: () => setState((s) => ({ celebrations: s.celebrations.slice(1) })),
}));

/** Promise-based confirmation dialog. */
export function confirmDialog(opts: Omit<ConfirmRequest, 'id' | 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    useUI.setState({
      confirmReq: {
        ...opts,
        id: seq++,
        resolve: (ok) => {
          useUI.setState({ confirmReq: null });
          resolve(ok);
        },
      },
    });
  });
}

export const toast = (t: Omit<Toast, 'id'>) => useUI.getState().pushToast(t);
