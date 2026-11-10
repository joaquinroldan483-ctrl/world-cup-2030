import type { Confederation, Team } from './types';

/**
 * The 64 participating teams of this custom configuration.
 * NOTE: the 2030 World Cup format (64 teams) and this list of participants
 * are a user-defined configuration, not official information.
 */
const T = (
  id: string,
  name: string,
  flag: string,
  confederation: Confederation,
  color: string,
  color2: string,
): Team => ({ id, name, flag, confederation, color, color2 });

export const TEAMS: Team[] = [
  // UEFA (21)
  T('ESP', 'España', 'es', 'UEFA', '#C60B1E', '#FFC400'),
  T('POR', 'Portugal', 'pt', 'UEFA', '#D52B1E', '#006600'),
  T('FRA', 'Francia', 'fr', 'UEFA', '#1F3C8C', '#EF4135'),
  T('ENG', 'Inglaterra', 'gb-eng', 'UEFA', '#E8E8EE', '#CE1124'),
  T('GER', 'Alemania', 'de', 'UEFA', '#1C1C1C', '#DD0000'),
  T('NED', 'Países Bajos', 'nl', 'UEFA', '#F36C21', '#21468B'),
  T('BEL', 'Bélgica', 'be', 'UEFA', '#E30613', '#FDDA24'),
  T('ITA', 'Italia', 'it', 'UEFA', '#0066B3', '#009246'),
  T('DEN', 'Dinamarca', 'dk', 'UEFA', '#C8102E', '#FFFFFF'),
  T('SWE', 'Suecia', 'se', 'UEFA', '#006AA7', '#FECC00'),
  T('NOR', 'Noruega', 'no', 'UEFA', '#BA0C2F', '#00205B'),
  T('SUI', 'Suiza', 'ch', 'UEFA', '#DA291C', '#FFFFFF'),
  T('TUR', 'Turquía', 'tr', 'UEFA', '#E30A17', '#FFFFFF'),
  T('UKR', 'Ucrania', 'ua', 'UEFA', '#0057B7', '#FFD700'),
  T('SRB', 'Serbia', 'rs', 'UEFA', '#C6363C', '#0C4076'),
  T('CRO', 'Croacia', 'hr', 'UEFA', '#E5242A', '#171796'),
  T('AUT', 'Austria', 'at', 'UEFA', '#ED2939', '#FFFFFF'),
  T('HUN', 'Hungría', 'hu', 'UEFA', '#CD2A3E', '#436F4D'),
  T('CZE', 'Chequia', 'cz', 'UEFA', '#D7141A', '#11457E'),
  T('GRE', 'Grecia', 'gr', 'UEFA', '#0D5EAF', '#FFFFFF'),
  T('KVX', 'Kosovo', 'xk', 'UEFA', '#244AA5', '#D0A650'),
  // CAF (13)
  T('MAR', 'Marruecos', 'ma', 'CAF', '#C1272D', '#006233'),
  T('SEN', 'Senegal', 'sn', 'CAF', '#00853F', '#FDEF42'),
  T('NGA', 'Nigeria', 'ng', 'CAF', '#008751', '#FFFFFF'),
  T('CIV', 'Costa de Marfil', 'ci', 'CAF', '#F77F00', '#009E60'),
  T('EGY', 'Egipto', 'eg', 'CAF', '#CE1126', '#C09300'),
  T('ALG', 'Argelia', 'dz', 'CAF', '#006233', '#D21034'),
  T('CMR', 'Camerún', 'cm', 'CAF', '#007A5E', '#FCD116'),
  T('GUI', 'Guinea', 'gn', 'CAF', '#CE1126', '#FCD116'),
  T('RSA', 'Sudáfrica', 'za', 'CAF', '#007749', '#FFB81C'),
  T('COD', 'RD Congo', 'cd', 'CAF', '#007FFF', '#F7D618'),
  T('MLI', 'Malí', 'ml', 'CAF', '#14B53A', '#FCD116'),
  T('BFA', 'Burkina Faso', 'bf', 'CAF', '#EF2B2D', '#009E49'),
  T('CPV', 'Cabo Verde', 'cv', 'CAF', '#003893', '#CF2027'),
  // AFC (12)
  T('JPN', 'Japón', 'jp', 'AFC', '#0B2A6F', '#BC002D'),
  T('KOR', 'Corea del Sur', 'kr', 'AFC', '#CD2E3A', '#0047A0'),
  T('IRN', 'Irán', 'ir', 'AFC', '#239F40', '#DA0000'),
  T('AUS', 'Australia', 'au', 'AFC', '#FFCD00', '#00843D'),
  T('KSA', 'Arabia Saudita', 'sa', 'AFC', '#006C35', '#FFFFFF'),
  T('UZB', 'Uzbekistán', 'uz', 'AFC', '#1EB53A', '#0099B5'),
  T('IRQ', 'Irak', 'iq', 'AFC', '#007A3D', '#CE1126'),
  T('QAT', 'Qatar', 'qa', 'AFC', '#8A1538', '#FFFFFF'),
  T('JOR', 'Jordania', 'jo', 'AFC', '#CE1126', '#007A3D'),
  T('UAE', 'Emiratos Árabes Unidos', 'ae', 'AFC', '#00732F', '#FF0000'),
  T('OMA', 'Omán', 'om', 'AFC', '#DB161B', '#008000'),
  T('IDN', 'Indonesia', 'id', 'AFC', '#CE1126', '#FFFFFF'),
  // CONMEBOL (8)
  T('ARG', 'Argentina', 'ar', 'CONMEBOL', '#74ACDF', '#F6B40E'),
  T('URU', 'Uruguay', 'uy', 'CONMEBOL', '#5CBFEB', '#FCD116'),
  T('BRA', 'Brasil', 'br', 'CONMEBOL', '#FEDD00', '#009C3B'),
  T('COL', 'Colombia', 'co', 'CONMEBOL', '#FCD116', '#003893'),
  T('ECU', 'Ecuador', 'ec', 'CONMEBOL', '#FFD100', '#0072CE'),
  T('PAR', 'Paraguay', 'py', 'CONMEBOL', '#D52B1E', '#0038A8'),
  T('CHI', 'Chile', 'cl', 'CONMEBOL', '#D52B1E', '#0039A6'),
  T('VEN', 'Venezuela', 've', 'CONMEBOL', '#7B1E3A', '#FFCC00'),
  // CONCACAF (8)
  T('MEX', 'México', 'mx', 'CONCACAF', '#006847', '#CE1126'),
  T('USA', 'Estados Unidos', 'us', 'CONCACAF', '#1F2A5A', '#B22234'),
  T('CAN', 'Canadá', 'ca', 'CONCACAF', '#D80621', '#FFFFFF'),
  T('PAN', 'Panamá', 'pa', 'CONCACAF', '#DA121A', '#072357'),
  T('CRC', 'Costa Rica', 'cr', 'CONCACAF', '#002B7F', '#CE1126'),
  T('JAM', 'Jamaica', 'jm', 'CONCACAF', '#FED100', '#009B3A'),
  T('HON', 'Honduras', 'hn', 'CONCACAF', '#0073CF', '#FFFFFF'),
  T('GUA', 'Guatemala', 'gt', 'CONCACAF', '#4997D0', '#FFFFFF'),
  // OFC (2)
  T('NZL', 'Nueva Zelanda', 'nz', 'OFC', '#E8E8EE', '#00247D'),
  T('FIJ', 'Fiyi', 'fj', 'OFC', '#68BFE5', '#CE1126'),
];

export const TEAM_BY_ID: Record<string, Team> = Object.fromEntries(TEAMS.map((t) => [t.id, t]));

export const HOST_IDS = ['ESP', 'POR', 'MAR'] as const;

/**
 * Default custom ranking used for pots and the strength of the auto-simulator.
 * This is an editable starting point (roughly inspired by recent form),
 * not an official ranking. Users can reorder it in Settings.
 */
export const DEFAULT_RANKING: string[] = [
  'ESP', 'ARG', 'FRA', 'ENG', 'BRA', 'POR', 'NED', 'BEL',
  'GER', 'CRO', 'ITA', 'MAR', 'COL', 'URU', 'MEX', 'USA',
  'SUI', 'JPN', 'SEN', 'IRN', 'DEN', 'KOR', 'AUS', 'ECU',
  'AUT', 'TUR', 'CAN', 'UKR', 'NOR', 'PAN', 'EGY', 'ALG',
  'SWE', 'NGA', 'CIV', 'SRB', 'HUN', 'PAR', 'CZE', 'GRE',
  'KSA', 'QAT', 'CMR', 'UZB', 'MLI', 'COD', 'IRQ', 'CHI',
  'VEN', 'RSA', 'CRC', 'BFA', 'JOR', 'UAE', 'GUI', 'CPV',
  'KVX', 'OMA', 'HON', 'JAM', 'GUA', 'IDN', 'NZL', 'FIJ',
];
