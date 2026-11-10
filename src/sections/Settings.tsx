import { useRef, useState } from 'react';
import { DEFAULT_RANKING, DEFAULT_TIEBREAKERS, STAGE_SHORT, TEAMS, TEAM_BY_ID, TIEBREAK_LABEL, type KnockoutStage, type TiebreakCriterion } from '../engine';
import { Flag } from '../components/brand';
import { Icon } from '../components/Icon';
import { Button, Card, Chip, cx, IconButton, SectionHeader, TextInput, Toggle } from '../components/ui';
import { downloadBlob, slugify } from '../lib/download';
import { useStore } from '../store/tournament';
import { persistence } from '../store/persistence';
import { confirmDialog, toast } from '../store/ui';

const ALL_CRITERIA: TiebreakCriterion[] = ['points', 'goalDiff', 'goalsFor', 'h2hPoints', 'h2hGoalDiff', 'h2hGoalsFor', 'wins', 'fairPlay', 'lots'];

export default function Settings() {
  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Settings · Ajustes" title="Settings" subtitle="Gestioná tus simulaciones, los criterios del torneo y las preferencias. Todo se guarda automáticamente en este navegador." />
      <div className="grid gap-5 xl:grid-cols-2">
        <TournamentCard />
        <SavedTournaments />
        <DataCard />
        <Preferences />
        <Tiebreakers />
        <Ranking />
        <TeamNames />
        <About />
      </div>
    </div>
  );
}

function TournamentCard() {
  const t = useStore((s) => s.t);
  const commit = useStore((s) => s.commit);
  const [name, setName] = useState(t.name);
  return (
    <Card className="p-5">
      <h2 className="mb-4 font-display text-2xl uppercase">Torneo activo</h2>
      <div className="space-y-3">
        <div className="flex gap-2">
          <TextInput className="flex-1" label="Nombre de la simulación" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          <Button className="mt-6" variant="outline" disabled={!name.trim() || name === t.name} onClick={() => commit((x) => ({ ...x, name: name.trim() }), { label: 'Renombrar torneo' })}>Guardar</Button>
        </div>
        <label className="block">
          <span className="label mb-1.5 block">Inicio del torneo (cuenta regresiva)</span>
          <input type="datetime-local" value={t.kickoff.slice(0, 16)} onChange={(e) => e.target.value && commit((x) => ({ ...x, kickoff: e.target.value }), { label: 'Cambiar fecha' })} className="h-11 w-full rounded-xl border border-white/10 bg-night-950/60 px-3 text-sm outline-none [color-scheme:dark] focus:border-gold/60" />
        </label>
        <p className="text-xs text-white/40">Creado el {new Date(t.createdAt).toLocaleString('es')} · última modificación {new Date(t.updatedAt).toLocaleString('es')}</p>
      </div>
    </Card>
  );
}

const PHASE_LABEL: Record<string, string> = { draw: 'Sin sorteo', groups: 'Fase de grupos', finished: 'Finalizado' };

function SavedTournaments() {
  const { index, t, newTournament, switchTournament, duplicateTournament, renameTournament, deleteTournament } = useStore();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-2xl uppercase">Simulaciones guardadas</h2>
        <Button size="sm" variant="gold" icon="plus" onClick={() => newTournament()}>Nuevo torneo</Button>
      </div>
      <ul className="space-y-2">
        {index
          .slice()
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map((m) => {
            const active = m.id === t.id;
            return (
              <li key={m.id} className={cx('rounded-xl border p-3', active ? 'border-gold/40 bg-gold/8' : 'border-white/8 bg-white/3')}>
                {editing === m.id ? (
                  <div className="flex gap-2">
                    <TextInput className="flex-1" value={draft} autoFocus onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (renameTournament(m.id, draft), setEditing(null))} />
                    <IconButton icon="check" label="Guardar nombre" onClick={() => { void renameTournament(m.id, draft); setEditing(null); }} />
                    <IconButton icon="x" label="Cancelar" onClick={() => setEditing(null)} />
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    {m.champion ? <Flag id={m.champion} className="w-8" /> : <span className="flex h-6 w-8 items-center justify-center rounded bg-white/6 text-white/40"><Icon name="trophy" size={14} /></span>}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold">{m.name}</span>
                        {active && <Chip tone="gold">Activo</Chip>}
                      </div>
                      <div className="text-[11px] text-white/45">
                        {PHASE_LABEL[m.phase] ?? STAGE_SHORT[m.phase as KnockoutStage] ?? m.phase}
                        {m.champion ? ` · Campeón: ${TEAM_BY_ID[m.champion]?.name}` : ''} · {new Date(m.updatedAt).toLocaleDateString('es')}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {!active && <IconButton icon="play" label="Abrir" onClick={() => switchTournament(m.id)} />}
                      <IconButton icon="edit" label="Renombrar" onClick={() => { setEditing(m.id); setDraft(m.name); }} />
                      <IconButton icon="copy" label="Duplicar" onClick={() => duplicateTournament(m.id)} />
                      <IconButton
                        icon="trash"
                        label="Eliminar"
                        onClick={async () => {
                          if (await confirmDialog({ title: 'Eliminar simulación', message: `Se eliminará "${m.name}" de forma permanente.`, confirmLabel: 'Eliminar', danger: true })) await deleteTournament(m.id);
                        }}
                      />
                    </div>
                  </div>
                )}
              </li>
            );
          })}
      </ul>
      <p className="mt-3 text-[11px] text-white/35">Almacenamiento: {persistence.backend} (local, en este navegador).</p>
    </Card>
  );
}

function DataCard() {
  const t = useStore((s) => s.t);
  const commit = useStore((s) => s.commit);
  const importTournament = useStore((s) => s.importTournament);
  const file = useRef<HTMLInputElement>(null);
  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ app: 'world-cup-2030-road-to-glory', exportedAt: new Date().toISOString(), tournament: t }, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `${slugify(t.name) || 'torneo'}.wc2030.json`);
    toast({ kind: 'success', title: 'Torneo exportado' });
  };
  return (
    <Card className="p-5">
      <h2 className="mb-4 font-display text-2xl uppercase">Datos</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button icon="download" onClick={exportJson}>Exportar torneo (JSON)</Button>
        <Button icon="upload" onClick={() => file.current?.click()}>Importar torneo</Button>
        <Button
          variant="danger"
          icon="undo"
          onClick={async () => {
            if (await confirmDialog({ title: 'Borrar todos los resultados', message: 'Se mantendrá el sorteo, pero se eliminarán los resultados de los 128 partidos. Podés deshacerlo con el botón Deshacer.', confirmLabel: 'Borrar resultados', danger: true }))
              await commit((x) => ({ ...x, results: {} }), { label: 'Borrar resultados' });
          }}
        >
          Borrar resultados
        </Button>
        <Button
          variant="danger"
          icon="trash"
          onClick={async () => {
            if (await confirmDialog({ title: 'Reiniciar el torneo', message: 'Se eliminarán el sorteo y todos los resultados de esta simulación. La configuración (ranking, desempates, nombres) se conserva. Podés deshacerlo.', confirmLabel: 'Reiniciar torneo', danger: true }))
              await commit((x) => ({ ...x, groups: null, drawSteps: [], drawMode: null, results: {} }), { label: 'Reiniciar torneo' });
          }}
        >
          Reiniciar torneo
        </Button>
      </div>
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            await importTournament(JSON.parse(await f.text()));
          } catch (err) {
            toast({ kind: 'error', title: 'No se pudo importar', message: (err as Error).message });
          }
        }}
      />
      <p className="mt-3 text-xs text-white/40">El archivo exportado incluye el sorteo, los resultados, los acontecimientos y la configuración. Al importar se crea una simulación nueva.</p>
    </Card>
  );
}

function Preferences() {
  const prefs = useStore((s) => s.prefs);
  const setPrefs = useStore((s) => s.setPrefs);
  return (
    <Card className="p-5">
      <h2 className="mb-2 font-display text-2xl uppercase">Preferencias</h2>
      <Toggle checked={prefs.sound} onChange={(v) => setPrefs({ sound: v })} label="Efectos de sonido" description="Bolillas del sorteo, silbato, gol, celebraciones (sintetizados)." />
      <label className="flex items-center gap-3 py-2">
        <Icon name="volume" className="text-white/50" />
        <input type="range" min={0} max={1} step={0.05} value={prefs.volume} disabled={!prefs.sound} onChange={(e) => setPrefs({ volume: Number(e.target.value) })} className="flex-1 accent-[#e8b84a]" />
        <span className="w-10 text-right text-sm tabular text-white/60">{Math.round(prefs.volume * 100)}%</span>
      </label>
      <Toggle checked={prefs.animations} onChange={(v) => setPrefs({ animations: v })} label="Animaciones y celebraciones" description="Celebraciones de victoria, clasificación, transiciones de fase y animación de campeón." />
    </Card>
  );
}

function Tiebreakers() {
  const t = useStore((s) => s.t);
  const commit = useStore((s) => s.commit);
  const list = t.tiebreakers;
  const set = (next: TiebreakCriterion[]) => commit((x) => ({ ...x, tiebreakers: next }), { label: 'Cambiar desempates' });
  const move = (i: number, dir: -1 | 1) => {
    const next = list.slice();
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    void set(next);
  };
  const unused = ALL_CRITERIA.filter((c) => !list.includes(c));
  return (
    <Card className="p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-display text-2xl uppercase">Criterios de desempate</h2>
        <Button size="sm" variant="ghost" onClick={() => set(DEFAULT_TIEBREAKERS.slice())}>Restablecer</Button>
      </div>
      <p className="mb-3 text-xs text-white/45">Se aplican en orden. Los criterios de enfrentamiento directo se calculan solo entre las selecciones empatadas. Si un cambio altera clasificados con eliminatorias jugadas, se pedirá confirmación.</p>
      <ol className="space-y-1.5">
        {list.map((c, i) => (
          <li key={c} className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/3 px-3 py-2">
            <span className="w-5 font-display text-gold-light">{i + 1}</span>
            <span className="flex-1 text-sm">{TIEBREAK_LABEL[c]}</span>
            <IconButton icon="chevronDown" className="rotate-180" label="Subir" disabled={i === 0} onClick={() => move(i, -1)} />
            <IconButton icon="chevronDown" label="Bajar" disabled={i === list.length - 1} onClick={() => move(i, 1)} />
            <IconButton icon="x" label="Quitar" disabled={list.length <= 1} onClick={() => set(list.filter((x) => x !== c))} />
          </li>
        ))}
      </ol>
      {unused.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {unused.map((c) => (
            <Button key={c} size="sm" variant="outline" icon="plus" onClick={() => set([...list, c])}>{TIEBREAK_LABEL[c]}</Button>
          ))}
        </div>
      )}
    </Card>
  );
}

function Ranking() {
  const t = useStore((s) => s.t);
  const commit = useStore((s) => s.commit);
  const [open, setOpen] = useState(false);
  const set = (next: string[]) => commit((x) => ({ ...x, ranking: next }), { label: 'Editar ranking' });
  const moveTo = (id: string, pos: number) => {
    const next = t.ranking.filter((x) => x !== id);
    next.splice(Math.max(0, Math.min(63, pos)), 0, id);
    void set(next);
  };
  return (
    <Card className="p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-display text-2xl uppercase">Ranking personalizado</h2>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => set(DEFAULT_RANKING.slice())}>Restablecer</Button>
          <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>{open ? 'Ocultar' : 'Editar'}</Button>
        </div>
      </div>
      <p className="mb-3 text-xs text-white/45">Ranking editable (no oficial). Define los bombos del sorteo por ranking y la fuerza relativa del simulador automático.</p>
      {open ? (
        <ol className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
          {t.ranking.map((id, i) => (
            <li key={id} className="flex items-center gap-2 rounded-lg bg-white/3 px-2 py-1">
              <input
                className="h-8 w-11 rounded-md border border-white/10 bg-night-950/60 text-center text-sm tabular outline-none focus:border-gold/60"
                defaultValue={i + 1}
                key={`${id}-${i}`}
                onBlur={(e) => {
                  const n = parseInt(e.target.value, 10);
                  if (Number.isFinite(n) && n - 1 !== i) moveTo(id, n - 1);
                }}
                aria-label={`Posición de ${TEAM_BY_ID[id].name}`}
              />
              <Flag id={id} className="w-6" />
              <span className="flex-1 truncate text-sm">{TEAM_BY_ID[id].name}</span>
              <span className="text-[10px] text-white/35">Bombo {Math.floor(i / 16) + 1}</span>
              <IconButton icon="chevronDown" className="h-8 w-8 rotate-180" label="Subir" disabled={i === 0} onClick={() => moveTo(id, i - 1)} />
              <IconButton icon="chevronDown" className="h-8 w-8" label="Bajar" disabled={i === 63} onClick={() => moveTo(id, i + 1)} />
            </li>
          ))}
        </ol>
      ) : (
        <div className="flex flex-wrap gap-1">
          {t.ranking.slice(0, 16).map((id, i) => (
            <span key={id} className="flex items-center gap-1 rounded-md bg-white/5 px-1.5 py-0.5 text-xs"><b className="text-white/40">{i + 1}</b><Flag id={id} className="w-4" />{id}</span>
          ))}
          <span className="px-1 text-xs text-white/40">… y 48 más</span>
        </div>
      )}
    </Card>
  );
}

function TeamNames() {
  const t = useStore((s) => s.t);
  const commit = useStore((s) => s.commit);
  const [q, setQ] = useState('');
  const list = TEAMS.filter((x) => !q || x.name.toLowerCase().includes(q.toLowerCase()) || (t.teamNames[x.id] ?? '').toLowerCase().includes(q.toLowerCase()));
  const setName = (id: string, v: string) =>
    commit((x) => {
      const teamNames = { ...x.teamNames };
      if (!v.trim() || v.trim() === TEAM_BY_ID[id].name) delete teamNames[id];
      else teamNames[id] = v.trim().slice(0, 40);
      return { ...x, teamNames };
    }, { label: 'Renombrar selección' });
  return (
    <Card className="p-5">
      <h2 className="mb-1 font-display text-2xl uppercase">Nombres de selecciones</h2>
      <p className="mb-3 text-xs text-white/45">Personalizá cómo se muestra cada selección (la selección y su identificador no cambian).</p>
      <TextInput placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="mt-3 max-h-[360px] space-y-1 overflow-y-auto pr-1">
        {list.map((x) => (
          <li key={x.id} className="flex items-center gap-2">
            <Flag id={x.id} className="w-6" />
            <span className="w-10 font-cond text-xs font-bold text-white/40">{x.id}</span>
            <input
              key={t.teamNames[x.id] ?? x.name}
              defaultValue={t.teamNames[x.id] ?? x.name}
              onBlur={(e) => e.target.value !== (t.teamNames[x.id] ?? x.name) && setName(x.id, e.target.value)}
              className="h-9 flex-1 rounded-lg border border-white/8 bg-night-950/50 px-3 text-sm outline-none focus:border-gold/60"
            />
            {t.teamNames[x.id] && <IconButton icon="undo" className="h-9 w-9" label="Restaurar" onClick={() => setName(x.id, '')} />}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function About() {
  return (
    <Card className="p-5 xl:col-span-2">
      <h2 className="mb-2 font-display text-2xl uppercase">Acerca de</h2>
      <div className="grid gap-4 text-sm text-white/60 md:grid-cols-3">
        <p><b className="text-white">Configuración no oficial.</b> El formato de 64 selecciones y la lista de participantes son una configuración personalizada. Proyecto de aficionados sin afiliación con la FIFA ni con las federaciones.</p>
        <p><b className="text-white">Recursos.</b> Banderas: flag-icons (licencia MIT). Tipografías: Anton, Barlow Condensed e Inter (SIL OFL). El emblema, el trofeo y los escudos son ilustraciones originales de esta app.</p>
        <p><b className="text-white">Audio.</b> La música de los vídeos y todos los efectos se generan de forma procedural en el navegador (Web Audio): composiciones originales, sin canciones comerciales.</p>
      </div>
    </Card>
  );
}
