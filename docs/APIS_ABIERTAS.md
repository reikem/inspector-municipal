# APIs y fuentes de datos abiertas

| Fuente | Para qué sirve | Estado |
|---|---|---|
| **Yo pago en Valpo · `PorNumeroArriendo?id=N`** | Permisos: titular, RUT, dirección, rubro, estado, deuda | **En uso.** Responde JSON (`application/json`); el navegador, por su encabezado `Accept`, puede recibir XML: el sistema acepta ambos. Es una consulta por número. |
| **mindicador.cl · `/api/utm`** | Valor de la UTM para convertir multas a pesos | **En uso.** API abierta de indicadores económicos (verificada). |
| **OpenStreetMap (teselas)** | Mapa base | **En uso.** Respeta su política de uso; en producción usa un proveedor con plan. |
| **Nominatim (OSM)** | Coordenadas exactas desde direcciones | Opcional (máx. 1 consulta/seg., con caché). Para volumen usa tu propia instancia. |
| **Overpass API (OSM)** | Grifos, paraderos, colegios y calles para validar zonas de exclusión | Por evaluar. |
| **datos.gob.cl** | Portal nacional de datos abiertos (comercio, patentes, cartografía) | **Por verificar** si hay conjuntos útiles de Valparaíso. |
| **Geoportal de Valparaíso (SECPLA)** | Capas de la ciudad (zonificación, equipamiento) | Creado por decreto publicado en el Diario Oficial el 27-jun-2025, con acceso a datos abiertos. **Por contactar** para confirmar URL y servicios (WMS/WFS/API). |
| **INE · Registros administrativos municipales** | Catálogo de registros | No es API abierta: acceso por convenio. |

## Recorrer «todos los permisos»
`syncRange` (en `src/services/permitsApi.ts`) recorre un rango de N.º de arriendo con pocas consultas en paralelo, pausa entre tandas, retroceso ante errores/429 y corte automático cuando aparecen muchos números seguidos sin permiso.
Recomendaciones: acota el rango, usa un proxy propio (evita CORS y limita el uso) y, para cargas completas, pide al municipio una exportación oficial. Estás agregando datos personales (nombre, RUT, deuda): trátalos con la reserva que exige la ley.
