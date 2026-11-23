export type PermitStatus = 'al_dia' | 'atrasado' | 'desactivado';

export interface Permit {
  numeroArriendo: number;
  nombres: string;
  rut: string;
  direccion: string;
  metraje: string;
  descripcion: string;
  estado: string;
  deuda: number;
  /** Calle normalizada (se calcula desde la dirección). */
  calle: string;
  lat?: number;
  lon?: number;
  source: 'api' | 'demo';
  fetchedAt: string;
}

export type CheckValue = 'ok' | 'fail' | 'na';
export type Outcome = 'aprobada' | 'observaciones' | 'multa';

export interface Inspection {
  id: string;
  /** Código corto que va en el QR. */
  code: string;
  permitNumber: number;
  permitName: string;
  permitRut: string;
  direccion: string;
  startedAt: string;
  finishedAt: string;
  inspectorName: string;
  inspectorId: string;
  checks: Record<string, CheckValue>;
  notes: string;
  photos: string[];
  gps?: { lat: number; lon: number; accuracy?: number };
  outcome: Outcome;
  fineId?: string;
  demo?: boolean;
}

export interface FineItem { ruleId: string; label: string; utm: number }

export interface Fine {
  id: string;
  folio: string;
  inspectionId: string;
  inspectionCode: string;
  permitNumber: number;
  permitName: string;
  permitRut: string;
  direccion: string;
  items: FineItem[];
  totalUtm: number;
  utmValue: number;
  totalClp: number;
  reincident: boolean;
  seizure: boolean;
  status: 'emitida' | 'pagada' | 'anulada';
  issuedAt: string;
  inspectorName: string;
  inspectorId: string;
  notes: string;
  demo?: boolean;
}

export interface Snapshot { date: string; alDia: number; atrasado: number; desactivado: number; deuda: number }

export type PrinterDriver = 'browser' | 'bluetooth' | 'usb' | 'rawbt' | 'bridge';

export interface Settings {
  inspectorName: string;
  inspectorId: string;
  municipality: string;
  department: string;
  utmValue: number;
  utmDate: string;
  fineCapUtm: number;
  fineCapReincidentUtm: number;
  legalFooter: string;
  printer: { driver: PrinterDriver; width: 58 | 80; codePage: 'wpc1252' | 'cp858'; copies: number };
  sync: { from: number; to: number; concurrency: number; delayMs: number; maxMisses: number };
  geocodeNominatim: boolean;
  showFullRut: boolean;
}

export interface SyncState {
  running: boolean;
  current: number;
  from: number;
  to: number;
  found: number;
  missing: number;
  errors: number;
  message: string;
}
