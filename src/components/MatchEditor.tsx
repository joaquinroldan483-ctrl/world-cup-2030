import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import {
  EVENT_LABEL,
  STAGE_LABEL,
  checkConsistency,
  emptyResult,
  resolveOutcome,
  syncScoreFromEvents,
  totals,
  uid,
  type EventType,
  type MatchEvent,
  type MatchResult,
  type Stage,
} from '../engine';
import { useStore, useTeamName } from '../store/tournament';
import { confirmDialog, toast } from '../store/ui';
import { Flag } from './brand';
import { Icon } from './Icon';
import { EventGlyph, EventList, MatchTimeline } from './match';
import { Button, Chip, cx, Modal, Segmented, Stepper, TextInput } from './ui';

export interface EditorTarget {
  matchId: string;
  stage: Stage;
  homeId: string;
  awayId: string;
  label: string;
}

const GROUP_TYPES: EventType[] = ['goal', 'penalty_goal', 'penalty_miss', 'own_goal', 'yellow', 'red', 'sub'];
const KO_TYPES: EventType[] = [...GROUP_TYPES, 'et_goal', 'shootout_scored', 'shootout_missed'];

const normalize = (r: MatchResult, knockout: boolean): MatchResult => {
  if (!knockout) return { ...r, extraTime: null, penalties: null, winner: null };
  const next = { ...r };
  if (r.regular.home !== r.regular.away) {
    next.extraTime = null;
    next.penalties = null;
  } else if (next.extraTime) {
    const t = totals(next);
    if (t.home !== t.away) next.penalties = null;
  } else {
    // No extra time played: penalties directly after 90' are allowed.
  }
  return next;
};

export function MatchEditor({ target, onClose }: { target: EditorTarget | null; onClose: () => void }) {
  return (
    <Modal open={!!target} onClose={onClose} wide title={target ? <span className="flex items-center gap-2"><Icon name="whistle" />{target.label}</span> : ''}>
      {target && <EditorBody key={target.matchId} target={target} onClose={onClose} />}
    </Modal>
  );
}

function EditorBody({ target, onClose }: { target: EditorTarget; onClose: () => void }) {
  const stored = useStore((s) => s.t.results[target.matchId]);
  const commit = useStore((s) => s.commit);
  const name = useTeamName();
  const knockout = target.stage !== 'GROUP';
  const valid = stored && stored.homeId === target.homeId && stored.awayId === target.awayId ? stored : undefined;
  const [draft, setDraft] = useState<MatchResult>(() => (valid ? structuredClone(valid) : emptyResult(target.homeId, target.awayId)));
  const [tab, setTab] = useState<'score' | 'momentum'>('score');
  const [editing, setEditing] = useState<MatchEvent | null>(null);

  const norm = normalize(draft, knockout);
  const outcome = knockout ? resolveOutcome(norm) : null;
  const issues = useMemo(() => checkConsistency(norm, knockout), [norm, knockout]);
  const regTied = draft.regular.home === draft.regular.away;
  const t = totals(norm);
  const etTied = t.home === t.away;

  const set = (patch: Partial<MatchResult>) => setDraft((d) => ({ ...d, ...patch }));

  const save = async () => {
    if (knockout && !outcome?.winner) {
      const ok = await confirmDialog({ title: 'Partido sin clasificado', message: 'El partido terminó igualado y no se definió un clasificado (prórroga, penales o elección manual). Se guardará, pero el cuadro no avanzará.', confirmLabel: 'Guardar igual' });
      if (!ok) return;
    }
    const final = { ...norm, homeId: target.homeId, awayId: target.awayId, updatedAt: Date.now() };
    const ok = await commit((x) => ({ ...x, results: { ...x.results, [target.matchId]: final } }), {
      label: `Resultado ${name(target.homeId)} ${final.regular.home}-${final.regular.away} ${name(target.awayId)}`,
      celebrate: 'match',
      matchId: target.matchId,
    });
    if (ok) {
      toast({ kind: 'success', title: 'Resultado guardado', message: `${name(target.homeId)} ${final.regular.home}-${final.regular.away} ${name(target.awayId)}` });
      onClose();
    }
  };

  const reset = async () => {
    if (!stored) {
      setDraft(emptyResult(target.homeId, target.awayId));
      return;
    }
    const ok = await confirmDialog({ title: 'Reiniciar partido', message: 'Se borrará el resultado y todos los acontecimientos de este partido.', confirmLabel: 'Reiniciar', danger: true });
    if (!ok) return;
    const done = await commit(
      (x) => {
        const results = { ...x.results };
        delete results[target.matchId];
        return { ...x, results };
      },
      { label: 'Reiniciar partido' },
    );
    if (done) onClose();
  };

  const upsertEvent = (e: MatchEvent) => {
    setDraft((d) => ({ ...d, events: d.events.some((x) => x.id === e.id) ? d.events.map((x) => (x.id === e.id ? e : x)) : [...d.events, e] }));
    setEditing(null);
  };

  return (
    <div className="space-y-5">
      {/* Scoreboard */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-night-950/60 p-4 sm:p-5">
        <div className="absolute inset-x-0 top-0 h-1 host-stripe opacity-80" />
        <div className="mb-3 flex items-center justify-between">
          <span className="label">{STAGE_LABEL[target.stage]}</span>
          {valid ? <Chip tone="emerald">Guardado</Chip> : <Chip>Pendiente</Chip>}
        </div>
        <div className="grid grid-cols-2 items-start gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-6">
          <div className="flex flex-col items-center gap-3">
            <TeamBlock id={target.homeId} highlight={outcome?.winner === 'home'} />
            <div className="sm:hidden">
              <Stepper value={draft.regular.home} onChange={(v) => set({ regular: { ...draft.regular, home: v } })} label={`Goles ${name(target.homeId)}`} />
            </div>
          </div>
          <div className="order-last hidden items-center gap-3 sm:order-none sm:flex">
            <Stepper size="lg" value={draft.regular.home} onChange={(v) => set({ regular: { ...draft.regular, home: v } })} label={`Goles ${name(target.homeId)}`} />
            <span className="font-display text-3xl text-white/30">:</span>
            <Stepper size="lg" value={draft.regular.away} onChange={(v) => set({ regular: { ...draft.regular, away: v } })} label={`Goles ${name(target.awayId)}`} />
          </div>
          <div className="flex flex-col items-center gap-3">
            <TeamBlock id={target.awayId} highlight={outcome?.winner === 'away'} />
            <div className="sm:hidden">
              <Stepper value={draft.regular.away} onChange={(v) => set({ regular: { ...draft.regular, away: v } })} label={`Goles ${name(target.awayId)}`} />
            </div>
          </div>
        </div>
        <div className="mt-2 text-center text-[11px] uppercase tracking-[0.2em] text-white/35">Tiempo reglamentario · 90'</div>
      </div>

      <Segmented value={tab} onChange={setTab} options={[{ value: 'score', label: knockout ? 'Prórroga · Penales · Clasificado' : 'Marcador' }, { value: 'momentum', label: `Momentum · ${draft.events.length}` }]} />

      {tab === 'score' && (
        <div className="space-y-4">
          {knockout ? (
            <>
              <AnimatePresence initial={false}>
                {regTied && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="rounded-2xl border border-gold/25 bg-gold/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-cond text-lg font-bold uppercase tracking-wide text-gold-light">Prórroga</div>
                          <div className="text-xs text-white/50">Goles marcados solo en los 30' de tiempo extra.</div>
                        </div>
                        <Button size="sm" variant={draft.extraTime ? 'ghost' : 'outline'} onClick={() => set({ extraTime: draft.extraTime ? null : { home: 0, away: 0 } })}>
                          {draft.extraTime ? 'Quitar prórroga' : 'Hubo prórroga'}
                        </Button>
                      </div>
                      {draft.extraTime && (
                        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                          <Flag id={target.homeId} className="w-8" />
                          <Stepper value={draft.extraTime.home} onChange={(v) => set({ extraTime: { ...draft.extraTime!, home: v } })} />
                          <span className="text-white/30">:</span>
                          <Stepper value={draft.extraTime.away} onChange={(v) => set({ extraTime: { ...draft.extraTime!, away: v } })} />
                          <Flag id={target.awayId} className="w-8" />
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence initial={false}>
                {regTied && etTied && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="rounded-2xl border border-emerald/25 bg-emerald/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-cond text-lg font-bold uppercase tracking-wide text-emerald-light">Definición por penales</div>
                          <div className="text-xs text-white/50">Resultado de la tanda.</div>
                        </div>
                        <Button size="sm" variant={draft.penalties ? 'ghost' : 'outline'} onClick={() => set({ penalties: draft.penalties ? null : { home: 0, away: 0 } })}>
                          {draft.penalties ? 'Quitar penales' : 'Hubo penales'}
                        </Button>
                      </div>
                      {draft.penalties && (
                        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                          <Flag id={target.homeId} className="w-8" />
                          <Stepper value={draft.penalties.home} max={30} onChange={(v) => set({ penalties: { ...draft.penalties!, home: v } })} />
                          <span className="text-white/30">:</span>
                          <Stepper value={draft.penalties.away} max={30} onChange={(v) => set({ penalties: { ...draft.penalties!, away: v } })} />
                          <Flag id={target.awayId} className="w-8" />
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="rounded-2xl border border-white/10 bg-white/4 p-4">
                <div className="label mb-2">Clasificado</div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {(['auto', 'home', 'away'] as const).map((w) => {
                    const active = w === 'auto' ? !draft.winner : draft.winner === w;
                    return (
                      <button
                        key={w}
                        onClick={() => set({ winner: w === 'auto' ? null : w })}
                        className={cx('flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition', active ? 'border-gold/60 bg-gold/12 text-white' : 'border-white/10 text-white/60 hover:border-white/25')}
                      >
                        {w === 'auto' ? <Icon name="sparkles" size={18} className="text-gold-light" /> : <Flag id={w === 'home' ? target.homeId : target.awayId} className="w-6" />}
                        <span className="truncate font-semibold">{w === 'auto' ? 'Automático (según marcador)' : name(w === 'home' ? target.homeId : target.awayId)}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center gap-2 text-sm">
                  {outcome?.winner ? (
                    <>
                      <Icon name="trophy" size={18} className="text-gold-light" />
                      <span>
                        Avanza <b>{name(outcome.winner === 'home' ? target.homeId : target.awayId)}</b>{' '}
                        <span className="text-white/50">
                          {outcome.decidedBy === 'regular' ? 'en los 90 minutos' : outcome.decidedBy === 'extra' ? 'en la prórroga' : outcome.decidedBy === 'penalties' ? 'por penales' : 'por elección manual'}
                        </span>
                      </span>
                    </>
                  ) : (
                    <span className="text-gold-light">Empate: cargá prórroga, penales o elegí al clasificado.</span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-white/55">En la fase de grupos el partido termina a los 90 minutos: victoria 3 pts, empate 1 pt.</p>
          )}
        </div>
      )}

      {tab === 'momentum' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/8 bg-night-950/40 p-4">
            <MatchTimeline result={norm} />
          </div>
          <EventForm
            key={editing?.id ?? 'new'}
            homeId={target.homeId}
            awayId={target.awayId}
            types={knockout ? KO_TYPES : GROUP_TYPES}
            initial={editing}
            nextShootoutKick={draft.events.filter((e) => e.type.startsWith('shootout')).length + 1}
            onSubmit={upsertEvent}
            onCancel={editing ? () => setEditing(null) : undefined}
          />
          <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-1">
            <EventList result={norm} onEdit={setEditing} onDelete={(e) => setDraft((d) => ({ ...d, events: d.events.filter((x) => x.id !== e.id) }))} />
          </div>
        </div>
      )}

      {issues.length > 0 && (
        <div className="rounded-2xl border border-gold/30 bg-gold/8 p-4">
          <div className="flex items-start gap-2 text-sm text-gold-light">
            <Icon name="alert" className="mt-0.5 shrink-0" />
            <div className="space-y-1">
              {issues.map((i) => (
                <div key={i.message}>{i.message}</div>
              ))}
            </div>
          </div>
          {issues.some((i) => i.message.includes('registrad')) && (
            <Button size="sm" variant="outline" className="mt-3" icon="sparkles" onClick={() => setDraft(syncScoreFromEvents(draft, knockout))}>
              Ajustar marcador a los acontecimientos
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-white/8 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="danger" icon="trash" onClick={reset}>
          Reiniciar partido
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="gold" icon="check" onClick={save}>Guardar resultado</Button>
        </div>
      </div>
    </div>
  );
}

function TeamBlock({ id, highlight }: { id: string; highlight?: boolean }) {
  const name = useTeamName();
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      <div className={cx('rounded-lg p-0.5 transition', highlight && 'bg-gold shadow-[0_0_30px_rgba(232,184,74,0.6)]')}>
        <Flag id={id} className="w-14 sm:w-20" />
      </div>
      <div className="w-full truncate font-cond text-sm font-bold uppercase tracking-wide sm:text-lg">{name(id)}</div>
    </div>
  );
}

function EventForm({
  homeId,
  awayId,
  types,
  initial,
  nextShootoutKick,
  onSubmit,
  onCancel,
}: {
  homeId: string;
  awayId: string;
  types: EventType[];
  initial: MatchEvent | null;
  nextShootoutKick: number;
  onSubmit: (e: MatchEvent) => void;
  onCancel?: () => void;
}) {
  const name = useTeamName();
  const [type, setType] = useState<EventType>(initial?.type ?? 'goal');
  const [team, setTeam] = useState<string>(initial?.teamId ?? homeId);
  const [minute, setMinute] = useState<string>(initial ? String(initial.minute) : '');
  const [added, setAdded] = useState<string>(initial?.added ? String(initial.added) : '');
  const [player, setPlayer] = useState(initial?.player ?? '');
  const [desc, setDesc] = useState(initial?.description ?? '');
  const shootout = type === 'shootout_scored' || type === 'shootout_missed';

  useEffect(() => {
    if (shootout && !initial) setMinute(String(nextShootoutKick));
    if (type === 'et_goal' && !initial && (!minute || Number(minute) <= 90)) setMinute('95');
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    const m = parseInt(minute, 10);
    if (!Number.isFinite(m) || m < (shootout ? 1 : 0) || m > (shootout ? 40 : 120)) {
      toast({ kind: 'error', title: 'Minuto inválido', message: shootout ? 'Indicá el orden del penal (1, 2, 3…).' : 'Ingresá un minuto entre 0 y 120.' });
      return;
    }
    if (type === 'et_goal' && m <= 90) {
      toast({ kind: 'error', title: 'Minuto inválido', message: 'Un gol en prórroga debe ser posterior al minuto 90.' });
      return;
    }
    const a = parseInt(added, 10);
    onSubmit({
      id: initial?.id ?? uid('e'),
      type,
      teamId: team,
      minute: m,
      added: !shootout && Number.isFinite(a) && a > 0 ? Math.min(a, 20) : undefined,
      player: player.trim() || undefined,
      description: desc.trim() || undefined,
    });
    if (!initial) {
      setPlayer('');
      setDesc('');
      setAdded('');
      if (shootout) setMinute(String(m + 1));
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/4 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-cond text-lg font-bold uppercase tracking-wide">{initial ? 'Editar acontecimiento' : 'Nuevo acontecimiento'}</div>
        {onCancel && <Button size="sm" variant="ghost" onClick={onCancel}>Cancelar edición</Button>}
      </div>
      <div className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {types.map((ty) => (
          <button key={ty} onClick={() => setType(ty)} className={cx('flex shrink-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-xs font-semibold transition', type === ty ? 'border-gold/60 bg-gold/12 text-white' : 'border-white/10 text-white/60 hover:border-white/25')}>
            <EventGlyph type={ty} size={18} />
            {EVENT_LABEL[ty]}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
        <div className="flex gap-2">
          {[homeId, awayId].map((id) => (
            <button key={id} onClick={() => setTeam(id)} className={cx('flex items-center gap-2 rounded-xl border px-3 py-2 text-sm', team === id ? 'border-gold/60 bg-gold/12' : 'border-white/10 text-white/60')}>
              <Flag id={id} className="w-6" />
              <span className="max-w-[7rem] truncate">{name(id)}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-[1fr_1fr] gap-2 sm:grid-cols-[90px_90px_1fr]">
          <TextInput inputMode="numeric" placeholder={shootout ? 'Orden' : "Minuto"} value={minute} onChange={(e) => setMinute(e.target.value.replace(/\D/g, ''))} aria-label="Minuto" />
          <TextInput inputMode="numeric" placeholder="+ añadido" disabled={shootout} value={added} onChange={(e) => setAdded(e.target.value.replace(/\D/g, ''))} aria-label="Tiempo añadido" />
          <TextInput className="col-span-2 sm:col-span-1" placeholder="Jugador (opcional)" value={player} onChange={(e) => setPlayer(e.target.value)} maxLength={60} />
        </div>
      </div>
      {type === 'own_goal' && <p className="mt-2 text-xs text-white/45">Para un autogol, elegí la selección <b>beneficiada</b> (la que suma el gol en el marcador).</p>}
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <TextInput className="flex-1" placeholder="Descripción (opcional)" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={200} />
        <Button variant="emerald" icon={initial ? 'check' : 'plus'} onClick={submit}>
          {initial ? 'Guardar cambios' : 'Agregar'}
        </Button>
      </div>
    </div>
  );
}
