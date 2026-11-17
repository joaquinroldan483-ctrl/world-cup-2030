import { useMemo, useState } from 'react';
import {
  CATALOG,
  CONFEDERATIONS,
  DEFAULT_PARTICIPANTS,
  EDITIONS,
  TEAM_BY_ID,
  rankingFor,
  replaceParticipant,
  resultsOfTeam,
  type Confederation,
} from '../engine';
import { useStore, useTeamName } from '../store/tournament';
import { confirmDialog, toast } from '../store/ui';
import { Flag } from './brand';
import { Icon } from './Icon';
import { Button, Card, Chip, cx, Modal } from './ui';

const MAX_HOSTS = 4;

/** Edit the 64 participating teams (and, in 2038, the hosts). */
export function ParticipantsEditor() {
  const t = useStore((s) => s.t);
  const commit = useStore((s) => s.commit);
  const name = useTeamName();
  const [replacing, setReplacing] = useState<string | null>(null);
  const [conf, setConf] = useState<Confederation | 'ALL'>('ALL');
  const def = EDITIONS[t.edition];
  const counts = useMemo(
    () => Object.fromEntries(CONFEDERATIONS.map((c) => [c, t.participants.filter((id) => TEAM_BY_ID[id]?.confederation === c).length])),
    [t.participants],
  );
  const list = t.participants
    .filter((id) => conf === 'ALL' || TEAM_BY_ID[id]?.confederation === conf)
    .sort((a, b) => name(a).localeCompare(name(b), 'es'));
  const lockedHost = (id: string) => !def.hostsEditable && t.hosts.includes(id);

  const doReplace = async (oldId: string, newId: string) => {
    const n = resultsOfTeam(t, oldId);
    if (n > 0) {
      const ok = await confirmDialog({
        title: `Reemplazar a ${name(oldId)}`,
        message: `${name(newId)} ocupará su lugar en la lista, en el ranking y en su grupo. Se borrarán los ${n} resultados de ${name(oldId)} porque ya no corresponden. Podés deshacerlo.`,
        confirmLabel: 'Reemplazar',
        danger: true,
      });
      if (!ok) return;
    }
    const done = await commit((x) => replaceParticipant(x, oldId, newId), { label: `${name(oldId)} → ${name(newId)}` });
    if (done) {
      setReplacing(null);
      toast({ kind: 'success', title: 'Selección reemplazada', message: `${name(newId)} entra por ${name(oldId)}` });
    }
  };

  const toggleHost = (id: string) =>
    commit(
      (x) => {
        const on = x.hosts.includes(id);
        if (!on && x.hosts.length >= MAX_HOSTS) throw new Error(`Máximo ${MAX_HOSTS} anfitriones.`);
        return { ...x, hosts: on ? x.hosts.filter((h) => h !== id) : [...x.hosts, id] };
      },
      { label: 'Cambiar anfitriones' },
    );

  const resetList = async () => {
    const ok = await confirmDialog({
      title: 'Restablecer participantes',
      message: 'Vuelve la lista original de 64 selecciones. Se borrarán el sorteo y los resultados si la lista cambia. Podés deshacerlo.',
      confirmLabel: 'Restablecer',
      danger: true,
    });
    if (!ok) return;
    await commit(
      (x) => {
        const same = x.participants.every((id) => DEFAULT_PARTICIPANTS.includes(id));
        if (same) return x;
        const participants = DEFAULT_PARTICIPANTS.slice();
        return {
          ...x,
          participants,
          ranking: rankingFor(participants),
          hosts: def.hostsEditable ? x.hosts.filter((h) => participants.includes(h)) : def.defaultHosts,
          groups: null,
          drawSteps: [],
          drawMode: null,
          results: {},
          groupOverrides: {},
        };
      },
      { label: 'Restablecer participantes' },
    );
  };

  return (
    <Card className="p-5 xl:col-span-2" >
      <div id="participantes" className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl uppercase">Selecciones participantes · {def.year}</h2>
          <p className="mt-1 max-w-2xl text-xs text-white/45">
            Cambiá cualquiera de las 64 clasificadas por otra selección del catálogo ({CATALOG.length} disponibles). El reemplazo toma su lugar en el ranking y, si ya hubo sorteo, en su mismo grupo.
            {def.hostsEditable ? ' Tocá la estrella para elegir los anfitriones (hasta 4).' : ' Los anfitriones de esta edición son fijos.'}
          </p>
        </div>
        <Button size="sm" variant="ghost" icon="undo" onClick={resetList}>Restablecer lista</Button>
      </div>
      <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
        {(['ALL', ...CONFEDERATIONS] as const).map((c) => (
          <button key={c} onClick={() => setConf(c)} className={cx('shrink-0 rounded-lg border px-3 py-1.5 font-cond text-xs font-bold uppercase tracking-wider', conf === c ? 'border-gold/60 bg-gold/15 text-gold-light' : 'border-white/10 text-white/60')}>
            {c === 'ALL' ? `Todas · ${t.participants.length}` : `${c} · ${counts[c]}`}
          </button>
        ))}
      </div>
      {def.hostsEditable && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-gold/25 bg-gold/8 px-3 py-2 text-sm">
          <Icon name="star" size={16} className="text-gold-light" />
          <span className="text-white/75">Anfitriones:</span>
          {t.hosts.length ? t.hosts.map((h) => <Chip key={h} tone="gold"><Flag id={h} className="w-4" /> {name(h)}</Chip>) : <span className="text-white/45">ninguno todavía</span>}
        </div>
      )}
      <div className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {list.map((id) => {
          const host = t.hosts.includes(id);
          return (
            <div key={id} className={cx('flex items-center gap-2 rounded-xl border px-2.5 py-1.5', host ? 'border-gold/40 bg-gold/8' : 'border-white/8 bg-white/3')}>
              <Flag id={id} className="w-7" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{name(id)}</span>
                <span className="text-[10px] text-white/40">{TEAM_BY_ID[id]?.confederation}{host ? ' · anfitrión' : ''}</span>
              </span>
              {def.hostsEditable && (
                <button onClick={() => toggleHost(id)} aria-pressed={host} aria-label={host ? `Quitar a ${name(id)} como anfitrión` : `Hacer anfitrión a ${name(id)}`} className={cx('rounded-lg p-1.5', host ? 'text-gold-light' : 'text-white/30 hover:text-white/70')}>
                  <Icon name="star" size={16} />
                </button>
              )}
              {lockedHost(id) ? (
                <span title="Anfitrión fijo de esta edición" className="p-1.5 text-gold-light/70"><Icon name="flag" size={16} /></span>
              ) : (
                <Button size="sm" variant="ghost" icon="swap" onClick={() => setReplacing(id)} aria-label={`Cambiar a ${name(id)}`}>
                  <span className="hidden sm:inline">Cambiar</span>
                </Button>
              )}
            </div>
          );
        })}
      </div>
      <ReplacePicker oldId={replacing} onClose={() => setReplacing(null)} onPick={(newId) => replacing && doReplace(replacing, newId)} />
    </Card>
  );
}

function ReplacePicker({ oldId, onClose, onPick }: { oldId: string | null; onClose: () => void; onPick: (id: string) => void }) {
  const t = useStore((s) => s.t);
  const name = useTeamName();
  const [q, setQ] = useState('');
  const [conf, setConf] = useState<Confederation | 'ALL' | 'SAME'>('SAME');
  const oldConf = oldId ? TEAM_BY_ID[oldId]?.confederation : undefined;
  const options = CATALOG.filter(
    (x) =>
      !t.participants.includes(x.id) &&
      (conf === 'ALL' || (conf === 'SAME' ? x.confederation === oldConf : x.confederation === conf)) &&
      (!q || x.name.toLowerCase().includes(q.toLowerCase()) || x.id.toLowerCase().includes(q.toLowerCase())),
  ).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return (
    <Modal open={!!oldId} onClose={onClose} title={oldId ? <span className="flex items-center gap-2"><Flag id={oldId} className="w-7" /> Reemplazar a {name(oldId)}</span> : ''}>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar selección…" className="h-11 w-full rounded-xl border border-white/10 bg-night-950/60 px-4 text-sm outline-none focus:border-gold/60" />
      <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
        {(['SAME', 'ALL', ...CONFEDERATIONS] as const).map((c) => (
          <button key={c} onClick={() => setConf(c)} className={cx('shrink-0 rounded-lg border px-3 py-1.5 font-cond text-xs font-bold uppercase tracking-wider', conf === c ? 'border-gold/60 bg-gold/15 text-gold-light' : 'border-white/10 text-white/60')}>
            {c === 'SAME' ? `Misma conf. (${oldConf})` : c === 'ALL' ? 'Todas' : c}
          </button>
        ))}
      </div>
      <div className="mt-3 grid max-h-[50dvh] grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
        {options.map((x) => (
          <button key={x.id} onClick={() => onPick(x.id)} className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-white/3 px-3 py-2 text-left transition hover:border-gold/50 hover:bg-white/6">
            <Flag id={x.id} className="w-8" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{x.name}</span>
              <span className="text-[10px] text-white/40">{x.id} · {x.confederation}</span>
            </span>
            <Icon name="chevronRight" size={16} className="text-white/30" />
          </button>
        ))}
        {options.length === 0 && <p className="col-span-full py-6 text-center text-sm text-white/45">No hay selecciones disponibles con ese filtro.</p>}
      </div>
    </Modal>
  );
}
