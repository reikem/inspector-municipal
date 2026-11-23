/**
 * Referencias de calles para ubicar permisos en el mapa SIN geocodificador.
 * ⚠️ Coordenadas APROXIMADAS (demostración). En producción usa un geocodificador real
 * (Nominatim/IDE/Geoportal) y guarda lat/lon exactos en cada permiso.
 */
export interface StreetRef {
  name: string;
  /** Texto con el que se reconoce la calle en la dirección. */
  match: string[];
  a: [number, number];
  b: [number, number];
  /** Rango de alturas (numeración) que cubren los puntos a y b. */
  from: number;
  to: number;
  /** Peso para generar datos de demostración (más peso = más comerciantes). */
  weight: number;
  /** Probabilidad de atraso en los datos de demostración. */
  arrears: number;
}

export const STREETS: StreetRef[] = [
  { name: 'Pedro Montt', match: ['PEDRO MONTT', 'P.MONTT', 'P MONTT'], a: [-33.0452, -71.624], b: [-33.0478, -71.6168], from: 1000, to: 3000, weight: 5, arrears: 0.5 },
  { name: 'Av. Argentina', match: ['ARGENTINA'], a: [-33.0478, -71.6168], b: [-33.05, -71.609], from: 1, to: 2000, weight: 3, arrears: 0.42 },
  { name: 'Av. Errázuriz', match: ['ERRAZURIZ'], a: [-33.0388, -71.629], b: [-33.044, -71.618], from: 100, to: 2800, weight: 4, arrears: 0.38 },
  { name: 'Condell', match: ['CONDELL'], a: [-33.043, -71.624], b: [-33.0475, -71.6165], from: 1, to: 2000, weight: 3, arrears: 0.3 },
  { name: 'Av. Independencia', match: ['INDEPENDENCIA'], a: [-33.0455, -71.6195], b: [-33.043, -71.61], from: 1, to: 2500, weight: 2, arrears: 0.25 },
  { name: 'Esmeralda', match: ['ESMERALDA'], a: [-33.0398, -71.627], b: [-33.042, -71.623], from: 1, to: 1000, weight: 2, arrears: 0.2 },
  { name: 'Plaza Victoria', match: ['PLAZA VICTORIA', 'VICTORIA'], a: [-33.0463, -71.62], b: [-33.0463, -71.62], from: 1, to: 1, weight: 2, arrears: 0.35 },
  { name: 'Plaza Sotomayor', match: ['SOTOMAYOR'], a: [-33.0394, -71.6286], b: [-33.0394, -71.6286], from: 1, to: 1, weight: 1, arrears: 0.15 },
  { name: 'Plaza Aníbal Pinto', match: ['ANIBAL PINTO'], a: [-33.0436, -71.6233], b: [-33.0436, -71.6233], from: 1, to: 1, weight: 1, arrears: 0.18 },
  { name: 'Av. Alemania', match: ['ALEMANIA'], a: [-33.0425, -71.632], b: [-33.0405, -71.6255], from: 1, to: 1800, weight: 1, arrears: 0.1 },
];

/** Normaliza texto para comparar (mayúsculas, sin tildes). */
export const norm = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

export function findStreet(text: string): StreetRef | undefined {
  const t = norm(text);
  return STREETS.find((s) => s.match.some((m) => t.includes(norm(m))));
}
