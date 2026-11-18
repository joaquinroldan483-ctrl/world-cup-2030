/**
 * World Cup editions supported by the app, each with its own identity.
 * Hosts of 2030 (Spain, Portugal, Morocco) and 2034 (Saudi Arabia) follow FIFA's announcements;
 * the 2038 hosts are chosen by the user. In every edition the number of teams, the list of
 * participants and the dates are a custom configuration, not official information.
 */
export type EditionId = '2030' | '2034' | '2038';

export interface EditionTheme {
  /** Main action colour (buttons, alerts) — maps to the "crimson" token. */
  primary: [string, string, string];
  /** Secondary colour (qualification, success) — maps to the "emerald" token. */
  secondary: [string, string, string];
  /** Accent / metallic colour — maps to the "gold" token: [base, light, dark]. */
  accent: [string, string, string];
  /** Background scale: 950, 900, 850, 800, 700, 600. */
  night: [string, string, string, string, string, string];
  /** Colours of the identity stripe. */
  stripe: string[];
  /** Three colours of the emblem ring. */
  ring: [string, string, string];
  /** Gradient of the giant year in the hero. */
  heroGradient: string[];
  /** Decorative motif drawn behind the app. */
  motif: 'iberia' | 'desert' | 'future';
}

export interface EditionDef {
  id: EditionId;
  year: number;
  title: string;
  tagline: string;
  theme: string;
  description: string;
  facts: string[];
  defaultHosts: string[];
  /** Default number of teams for new tournaments of this edition. */
  defaultTeams: import('./formats').TeamCount;
  /** Whether the user picks the hosts (2038). */
  hostsEditable: boolean;
  /** Text used for posters and video when there are no editable hosts. */
  hostsLabel: string;
  kickoff: string;
  colors: EditionTheme;
}

export const EDITIONS: Record<EditionId, EditionDef> = {
  '2030': {
    id: '2030',
    year: 2030,
    title: 'WORLD CUP 2030',
    tagline: 'The Road to Glory',
    theme: 'Centenario · Tres países, dos continentes',
    description:
      'España, Portugal y Marruecos comparten el Mundial del centenario: un puente entre Europa y África sobre el Estrecho de Gibraltar, con los colores rojo, verde y oro de los tres anfitriones.',
    facts: [
      'Anfitriones: España, Portugal y Marruecos.',
      'Edición del centenario: 100 años después del primer Mundial (Uruguay 1930).',
      'FIFA anunció partidos conmemorativos del centenario en Uruguay, Argentina y Paraguay.',
    ],
    defaultHosts: ['ESP', 'POR', 'MAR'],
    defaultTeams: 64,
    hostsEditable: false,
    hostsLabel: 'ESPAÑA · PORTUGAL · MAROC',
    kickoff: '2030-06-13T19:00',
    colors: {
      primary: ['#e11d2e', '#ff4d5b', '#8f0b18'],
      secondary: ['#10b26c', '#3ddc97', '#065f3c'],
      accent: ['#e8b84a', '#f8dd8b', '#a87a1c'],
      night: ['#04070f', '#070d1c', '#0a1226', '#0e1830', '#16244a', '#22336a'],
      stripe: ['#c60b1e', '#ffc400', '#c60b1e', '#046a38', '#da291c', '#c1272d', '#006233'],
      ring: ['#e11d2e', '#ffc400', '#10b26c'],
      heroGradient: ['#ff3b47', '#ffc400', '#f6d77f', '#12b26e', '#0b8a4f'],
      motif: 'iberia',
    },
  },
  '2034': {
    id: '2034',
    year: 2034,
    title: 'WORLD CUP 2034',
    tagline: 'Desert of Champions',
    theme: 'Arabia Saudita · Arena del desierto',
    description:
      'El Mundial llega a Arabia Saudita: verde profundo, oro de las dunas y la geometría de los mosaicos tradicionales. Noches de estadio bajo las estrellas del desierto.',
    facts: [
      'Anfitrión: Arabia Saudita, confirmado por el Congreso de la FIFA en diciembre de 2024.',
      'Primera Copa del Mundo con un único anfitrión de Oriente Medio desde Qatar 2022.',
      'Formato oficial previsto de 48 selecciones (12 grupos y 8 mejores terceros); podés elegir 16, 24, 32, 48 o 64.',
    ],
    defaultHosts: ['KSA'],
    defaultTeams: 48,
    hostsEditable: false,
    hostsLabel: 'ARABIA SAUDITA · السعودية',
    kickoff: '2034-06-15T19:00',
    colors: {
      primary: ['#0f9d58', '#3ccf8a', '#065c33'],
      secondary: ['#14b8a6', '#5eead4', '#0b6b62'],
      accent: ['#d9a54a', '#f5d9a0', '#8f6421'],
      night: ['#020b08', '#04130e', '#061a14', '#09231a', '#0f3a2a', '#174d39'],
      stripe: ['#006c35', '#ffffff', '#006c35', '#d9a54a', '#006c35'],
      ring: ['#0f9d58', '#d9a54a', '#ffffff'],
      heroGradient: ['#f5d9a0', '#d9a54a', '#ffffff', '#3ccf8a', '#0f9d58'],
      motif: 'desert',
    },
  },
  '2038': {
    id: '2038',
    year: 2038,
    title: 'WORLD CUP 2038',
    tagline: 'Future Football',
    theme: 'Edición del futuro · Sede a tu elección',
    description:
      'Una edición todavía sin sede: elegí vos los anfitriones. Estética futurista de neón, estadios inteligentes y luces de plasma sobre un cielo índigo.',
    facts: [
      'Sede sin definir en esta app: elegí de 1 a 4 anfitriones en Settings → Selecciones participantes.',
      'Los colores del emblema y de la franja se adaptan a los anfitriones que elijas.',
      'Formato, participantes y fechas son una configuración personalizada.',
    ],
    defaultHosts: [],
    defaultTeams: 48,
    hostsEditable: true,
    hostsLabel: 'SEDE POR DEFINIR',
    kickoff: '2038-06-11T19:00',
    colors: {
      primary: ['#e0218a', '#ff5fb0', '#8c0f55'],
      secondary: ['#00c2d1', '#5ef0ff', '#00707a'],
      accent: ['#8fe3ff', '#dcf7ff', '#3a8fb0'],
      night: ['#05030f', '#0a0720', '#0f0a2c', '#150f3a', '#231a5c', '#33267a'],
      stripe: ['#e0218a', '#7c5cff', '#00c2d1', '#5ef0ff', '#7c5cff', '#e0218a'],
      ring: ['#e0218a', '#7c5cff', '#00c2d1'],
      heroGradient: ['#ff5fb0', '#b69cff', '#dcf7ff', '#5ef0ff', '#00c2d1'],
      motif: 'future',
    },
  },
};

export const EDITION_IDS: EditionId[] = ['2030', '2034', '2038'];
