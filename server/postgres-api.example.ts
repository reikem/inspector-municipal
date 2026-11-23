/**
 * API DE EJEMPLO para PostgreSQL (COMENTADA). Es un servidor Node aparte del frontend.
 *   pnpm add express pg cors helmet express-rate-limit jsonwebtoken   (en la carpeta del servidor)
 * Variables: DATABASE_URL=postgres://usuario:clave@host:5432/inspector   JWT_SECRET=...
 * Importante: autentica a los inspectores (JWT u otro), limita las solicitudes y NUNCA expongas DATABASE_URL al navegador.
 */

// import express from 'express';
// import cors from 'cors';
// import helmet from 'helmet';
// import rateLimit from 'express-rate-limit';
// import jwt from 'jsonwebtoken';
// import { Pool } from 'pg';
//
// const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// const app = express();
// app.use(helmet(), cors({ origin: process.env.ALLOWED_ORIGIN }), express.json({ limit: '5mb' }));
// app.use(rateLimit({ windowMs: 60_000, limit: 120 }));
//
// // Verificación pública del QR (sin login, devuelve solo campos no sensibles)
// app.get('/api/verify/:code', async (req, res) => {
//   const { rows } = await pool.query('select * from verify_inspection($1)', [req.params.code]);
//   rows[0] ? res.json(rows[0].verify_inspection) : res.sendStatus(404);
// });
//
// // Todo lo demás exige token de inspector
// app.use('/api', (req, res, next) => {
//   try { jwt.verify((req.headers.authorization ?? '').replace('Bearer ', ''), process.env.JWT_SECRET!); next(); }
//   catch { res.sendStatus(401); }
// });
//
// app.get('/api/permits', async (_q, res) => res.json((await pool.query('select * from permits')).rows));
// app.put('/api/permits', async (req, res) => {
//   for (const p of req.body) {
//     await pool.query(
//       `insert into permits (numero_arriendo, nombres, rut, direccion, metraje, descripcion, estado, deuda, calle, lat, lon, source, fetched_at)
//        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
//        on conflict (numero_arriendo) do update set nombres=$2, rut=$3, direccion=$4, metraje=$5, descripcion=$6, estado=$7, deuda=$8, calle=$9, lat=$10, lon=$11, fetched_at=$13`,
//       [p.numeroArriendo, p.nombres, p.rut, p.direccion, p.metraje, p.descripcion, p.estado, p.deuda, p.calle, p.lat, p.lon, p.source, p.fetchedAt]);
//   }
//   res.sendStatus(204);
// });
// app.post('/api/folio/next', async (_q, res) =>
//   res.json({ folio: (await pool.query("select next_folio() as f")).rows[0].f }));
// // …inspections, fines, snapshots y settings siguen el mismo patrón (insert … on conflict do update).
//
// app.listen(3001, () => console.log('API lista en :3001'));
export {};
