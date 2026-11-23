/**
 * Lista de verificación de la fiscalización. Es de REFERENCIA: la Ordenanza N.º 45 fue dejada sin efecto
 * por la Corte de Apelaciones (27-oct-2026). Ajusta reglas y montos a la normativa que esté vigente.
 */
export type RuleGroup = 'documentos' | 'puesto' | 'ubicacion' | 'mercaderia';
export type Severity = 'leve' | 'grave' | 'gravisima';

export interface Rule {
  id: string;
  group: RuleGroup;
  label: string;
  help: string;
  severity: Severity;
  /** Multa sugerida en UTM si no cumple. */
  utm: number;
  /** Se completa solo con los datos del permiso. */
  auto?: 'vigente' | 'al_dia';
  /** Si no cumple: hay sospecha de especies de procedencia ilícita o falsificadas (requiere procedimiento aparte). */
  seizure?: boolean;
}

export const GROUPS: Record<RuleGroup, string> = {
  documentos: 'Documentos y permiso',
  puesto: 'Puesto, mesa y toldo',
  ubicacion: 'Ubicación y horario',
  mercaderia: 'Mercadería',
};

export const RULES: Rule[] = [
  { id: 'permiso_vigente', group: 'documentos', label: 'Permiso municipal vigente', help: 'Se verifica en el sistema municipal.', severity: 'grave', utm: 1, auto: 'vigente' },
  { id: 'pagos_al_dia', group: 'documentos', label: 'Derechos municipales al día', help: 'Se verifica en el sistema municipal. Si hay deuda, se notifica.', severity: 'leve', utm: 0.5, auto: 'al_dia' },
  { id: 'credencial_visible', group: 'documentos', label: 'Credencial visible y a nombre del titular', help: 'Es personal e intransferible: debe coincidir con quien atiende.', severity: 'leve', utm: 0.5 },
  { id: 'mesa_medidas', group: 'puesto', label: 'Mesa dentro de las medidas (1,5 × 1,5 × 0,8 m)', help: 'Frente, fondo y alto máximos de referencia.', severity: 'leve', utm: 0.5 },
  { id: 'toldo', group: 'puesto', label: 'Toldo o parasol seguro y sin invadir el paso', help: 'Bien afirmado, sin obstruir el tránsito peatonal.', severity: 'leve', utm: 0.5 },
  { id: 'mercaderia_suelo', group: 'puesto', label: 'Sin mercadería directamente en el suelo', help: 'Todo se exhibe sobre la mesa.', severity: 'leve', utm: 0.5 },
  { id: 'metraje', group: 'puesto', label: 'Ocupa solo el metraje autorizado', help: 'Compara con el metraje del permiso.', severity: 'leve', utm: 1 },
  { id: 'limpieza', group: 'puesto', label: 'Puesto y entorno limpios', help: 'Sin residuos; recoge al terminar.', severity: 'leve', utm: 0.5 },
  { id: 'rubro', group: 'mercaderia', label: 'Vende solo el rubro autorizado', help: 'Compara con la descripción del permiso.', severity: 'grave', utm: 1 },
  { id: 'respaldo', group: 'mercaderia', label: 'Tiene boletas o facturas de respaldo', help: 'Puede exhibirlas si se le piden.', severity: 'grave', utm: 1 },
  { id: 'sanitaria', group: 'mercaderia', label: 'Autorización sanitaria (si vende alimentos)', help: 'Marca «No aplica» si no vende alimentos.', severity: 'grave', utm: 1 },
  { id: 'prohibidos', group: 'mercaderia', label: 'Sin productos prohibidos (cigarrillos, medicamentos)', help: 'Su venta está prohibida en la vía pública.', severity: 'grave', utm: 2 },
  { id: 'falsificada', group: 'mercaderia', label: 'Sin sospecha de mercadería falsificada o de origen ilícito', help: 'Solo registra la sospecha y la evidencia. El decomiso y la denuncia siguen el procedimiento legal.', severity: 'gravisima', utm: 2, seizure: true },
  { id: 'acera_2m', group: 'ubicacion', label: 'Acera con al menos 2 m de ancho libre', help: 'No se instala donde el paso quede estrecho.', severity: 'grave', utm: 1 },
  { id: 'zonas_exclusion', group: 'ubicacion', label: 'Fuera de zonas de exclusión', help: 'Grifos, colegios, urgencias, paraderos y vías de evacuación por tsunami.', severity: 'grave', utm: 2 },
  { id: 'horario', group: 'ubicacion', label: 'Dentro del horario (08:00 a 18:30)', help: 'Máximo 8 horas diarias de referencia.', severity: 'leve', utm: 0.5 },
];
