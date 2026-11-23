# Cómo contribuir

1. Haz un *fork* o crea una rama: `git checkout -b mejora/lo-que-sea`.
2. `pnpm install` y `pnpm dev`.
3. Antes de abrir el *pull request*: `pnpm build` (revisa tipos con `tsc` y compila).
4. Describe qué cambia y por qué. Si tocas reglas de fiscalización o montos (`src/data/rules.ts`), indica la normativa en que te basas.

## Convenciones
* TypeScript estricto, sin `any` salvo en conectores comentados.
* Textos de la interfaz en español de Chile; tildes y ñ correctas.
* Componentes reutilizables en `src/components`, lógica sin interfaz en `src/services`, acceso a datos solo por `src/repository`.
* No agregues datos personales reales al repositorio: usa los datos ficticios de `src/data/demo.ts`.

## Ideas
Autenticación de inspectores, firma del QR en servidor, Storage para fotos, geocodificación exacta y modo sin conexión.
