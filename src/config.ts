export type Backend = 'memory' | 'supabase' | 'postgres';

export const config = {
  backend: ((import.meta.env.VITE_DATA_BACKEND as string | undefined) || 'memory') as Backend,
  permitsApi:
    (import.meta.env.VITE_PERMITS_API as string | undefined) ||
    'https://yopagoenvalpo.cl/api/provisorias/provisorias/PorNumeroArriendo',
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '',
  supabaseKey: (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? '',
  postgresApi: (import.meta.env.VITE_POSTGRES_API as string | undefined) ?? '',
} as const;

export const defaultSettings = {
  inspectorName: 'Inspector/a municipal',
  inspectorId: 'INS-000',
  municipality: 'Municipalidad de Valparaíso',
  department: 'Dirección de Inspección y Fiscalización',
  utmValue: 70000,
  utmDate: '',
  fineCapUtm: 2,
  fineCapReincidentUtm: 4,
  legalFooter:
    'Plazo, lugar de pago y vía de reclamo: según la normativa vigente. Complete este texto en Ajustes antes de usar la boleta en terreno.',
  printer: { driver: 'browser', width: 58, codePage: 'wpc1252', copies: 1 },
  sync: { from: 70000, to: 70400, concurrency: 3, delayMs: 250, maxMisses: 40 },
  geocodeNominatim: false,
  showFullRut: false,
} as const;
