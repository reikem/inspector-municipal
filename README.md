# Inspección Municipal · Comercio en BNUP 🛡️🗺️🧾

[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev/)
[![pnpm](https://img.shields.io/badge/pnpm-secure-F69220?style=for-the-badge&logo=pnpm&logoColor=white)](https://pnpm.io/)
[![Deploy](https://img.shields.io/badge/GitHub_Pages-listo-222?style=for-the-badge&logo=github&logoColor=white)](docs/DESPLIEGUE_GITHUB_PAGES.md)

**Panel del inspector municipal** para fiscalizar el comercio ambulante en bienes nacionales de uso público (BNUP): estado de los permisos, mapa de calor de atrasos por calle, inspecciones con lista de verificación, **QR de resultado** para el comerciante y **boleta de multa** imprimible en terminales **POS Android, POS móvil con impresora integrada o PDA**.

Funciona hoy **solo con la memoria del navegador** (IndexedDB) y con datos de demostración; los conectores a **Supabase** y **PostgreSQL** están listos y comentados.

---

## 🖥️ Módulos

| Panel | Permisos | Mapa | Inspección | Multas |
| :---: | :---: | :---: | :---: | :---: |
| KPIs, anillo al día/atrasados/desactivados, seguimiento de 30 días, mapa de calor, calles con más atrasos | Búsqueda, filtros, ficha y **recorrido de la API** | Calor por atrasos o deuda + puntos por estado | Escaneo del QR de la credencial, checklist, fotos, GPS, resultado y QR | Registro, estado, reimpresión y CSV |

1. **Panel:** permisos al día / atrasados / desactivados, deuda acumulada, gráfico de seguimiento (30 días), inspecciones y multas por día, **mapa de calor** y ranking de calles. Cada gráfico se **exporta como imagen PNG o SVG** (con título, leyenda y fecha).
2. **Comerciantes / Permisos:** tabla con **búsqueda, filtros (estado, calle, origen, rango de deuda), orden por columna, paginación (10/25/50/100) y exportación a CSV** de lo filtrado, más la **sincronización** que recorre un rango de N.º de arriendo consultando la API municipal (con pausa, reintentos y corte automático).
3. **Inspección:** reglas de referencia (mesa 1,5 × 1,5 × 0,8 m, toldo, mercadería en el suelo, credencial, horario, acera ≥ 2 m, zonas de exclusión, boletas de respaldo, autorización sanitaria, productos prohibidos y **sospecha de mercadería falsificada**). Se completan solas la vigencia y los pagos.
4. **QR para el comerciante:** al registrar, se emite un QR; el comerciante lo escanea y ve si **pasó la inspección** y si tiene una **multa** (monto y folio). La página pública no muestra RUT ni dirección.
5. **Boleta de multa y comprobante:** vista previa de 58/80 mm, impresión por navegador, Bluetooth BLE, USB, RawBT o puente nativo (ESC/POS con QR nativo y acentos).
6. **Fuentes de datos:** catálogo de APIs abiertas con botón de prueba (UTM, API de permisos, Nominatim).
7. **Ajustes:** inspector, UTM (se actualiza desde mindicador.cl), topes de multa, texto legal, impresora, respaldo JSON.

---

## 🏗️ Arquitectura

```
 Navegador (React + TypeScript) ── pages/ components/ ── store.ts (estado)
      │                                  │
      │                         services/ (permitsApi · stats · verify · printing)
      │                                  │
      ▼                                  ▼
 repository/index.ts  ──►  MemoryRepository  (IndexedDB, activo hoy)
                      ┄┄►  SupabaseRepository (comentado)  ──► Supabase + RLS
                      ┄┄►  PostgresHttpRepository (comentado) ─► tu API ─► PostgreSQL
```

Todas las pantallas hablan con la interfaz `Repository` (`src/repository/types.ts`): cambiar de backend no toca la interfaz.

---

## ⚙️ Puesta en marcha

```bash
corepack enable        # o instala pnpm desde pnpm.io
pnpm install
pnpm dev               # http://localhost:5173
pnpm build             # revisa tipos y genera /dist
```

La primera vez se cargan **datos ficticios** (N.º 9 900 001 en adelante, para no chocar con permisos reales). En **Permisos → Sincronizar** recorres la API real y esos datos se reemplazan.

### API de permisos y CORS
`VITE_PERMITS_API` apunta por defecto a `https://yopagoenvalpo.cl/api/provisorias/provisorias/PorNumeroArriendo`. Responde JSON (o XML según `Accept`) y el sistema acepta ambos. Si el navegador la bloquea por **CORS**, pasa por un proxy tuyo (Edge Function, Cloudflare Worker o servidor) que además limite el uso.

> ⚠️ **Uso responsable:** la API es de consulta individual. Recorrerla masivamente agrega datos personales y genera carga: acota rangos, pide autorización al municipio y, para cargas completas, solicita una exportación oficial.

---

## 🗄️ Conectores de base de datos (comentados)

1. Ejecuta `db/schema.sql` (tablas, folio atómico, RLS y la función pública `verify_inspection`).
2. **Supabase:** `pnpm add @supabase/supabase-js`, define `VITE_DATA_BACKEND=supabase`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`; descomenta `src/repository/supabase.connector.ts` y el bloque de `src/repository/index.ts`. Autentica a los inspectores con Supabase Auth. **La secret key nunca va en el frontend.**
3. **PostgreSQL:** el navegador no se conecta directo. Levanta tu API (ejemplo comentado en `server/postgres-api.example.ts`: Express + `pg` + JWT + rate limit), define `VITE_DATA_BACKEND=postgres` y `VITE_POSTGRES_API`, y descomenta `postgres.connector.ts`.

---

## 🖨️ Impresión en terminales

| Método | Cuándo usarlo |
|---|---|
| **Navegador** | Cualquier impresora que Android/PC vea. Imprime solo la boleta (`@media print`, 58/80 mm, sin márgenes). |
| **Bluetooth BLE** | Impresoras térmicas BLE desde Chrome (HTTPS). No sirve para Bluetooth clásico (SPP). |
| **USB (WebUSB)** | PDA/POS con impresora por USB, desde Chrome. |
| **RawBT** | App Android que imprime ESC/POS por Bluetooth clásico, USB o red: el sistema abre `rawbt:base64,…`. |
| **Puente nativo** | POS con impresora integrada (Sunmi, PAX, Urovo…): tu app Android (WebView) expone `AndroidPrinter.printRaw(base64)` y envía los bytes al SDK del fabricante. |

Los comandos ESC/POS (`src/services/printing/escpos.ts`) incluyen tabla de caracteres WPC1252 o CP858 (acentos y ñ), QR nativo y corte. En **Ajustes → Imprimir prueba** puedes validar ancho, acentos y QR antes de salir a terreno.

---

## 🚀 Publicar en GitHub Pages

1. Sube el repositorio a GitHub. 2. **Settings → Pages → Source: GitHub Actions**. 3. Cada *push* a `main` compila y publica. Guía completa, ruta base y variables: [`docs/DESPLIEGUE_GITHUB_PAGES.md`](docs/DESPLIEGUE_GITHUB_PAGES.md).

> GitHub Pages es público: con datos reales exige inicio de sesión (Supabase Auth) y RLS.

---

## 🔒 Seguridad y privacidad

* RUT enmascarado en pantalla (completo solo en la boleta, que es documento legal); la página pública del QR no muestra RUT, dirección ni fotos.
* **QR en modo memoria:** el resultado viaja dentro de la URL, sirve para probar el flujo pero **no es a prueba de falsificación**. Con Supabase/PostgreSQL el QR solo lleva el código y se valida en el servidor (`verify_inspection`).
* Las fotos de evidencia se guardan reducidas en el navegador; en producción usa Storage con acceso restringido.
* Las reglas y multas son **de referencia**: la Ordenanza N.º 45 fue dejada sin efecto (27-oct-2026). Ajusta `src/data/rules.ts` y los textos legales con la unidad jurídica. La sospecha de mercadería falsificada solo deja constancia: el decomiso y la denuncia siguen el procedimiento legal.
* `pnpm-workspace.yaml` bloquea scripts de instalación salvo `esbuild` y exige 3 días de antigüedad a cada versión.

---

## 📂 Estructura

```
inspector-valpo/
├── db/schema.sql                      # PostgreSQL / Supabase (RLS + funciones)
├── .github/workflows/                 # deploy.yml (Pages) · ci.yml
├── docs/APIS_ABIERTAS.md              # fuentes de datos y su estado
├── docs/DESPLIEGUE_GITHUB_PAGES.md    # publicación paso a paso
├── CONTRIBUTING.md · SECURITY.md · CHANGELOG.md
├── server/postgres-api.example.ts     # API de ejemplo (comentada)
└── src/
    ├── data/        rules.ts · streets.ts · demo.ts
    ├── repository/  types · memory · supabase.connector · postgres.connector
    ├── services/    permitsApi · geo · nominatim · utm · stats · verify · printing/{escpos,ticket,printers}
    ├── components/  DataTable · ExportMenu · charts · HeatMap · Scanner · QrCode · TicketView · Layout · ui
    ├── pages/       Dashboard · Permits · MapPage · Inspect · Fines · Sources · Settings · PublicVerify
    └── store.ts     estado global + acciones
```

## 🚧 Pendientes sugeridos
Autenticación de inspectores, firma del QR en servidor, Storage para fotos, geocodificación exacta (Geoportal/Nominatim) y modo sin conexión con cola de sincronización.

## 📄 Licencia
MIT.
