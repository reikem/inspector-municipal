import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Modal } from './ui';

interface Detector { detect(src: CanvasImageSource): Promise<{ rawValue: string }[]> }
type DetectorCtor = new (o: { formats: string[] }) => Detector;

const HOST = 'yopagoenvalpo.cl';
/** N.º de arriendo desde el QR de la credencial (URL del sistema) o desde un número suelto. Nunca se abre la URL. */
export function extractId(raw: string): number | null {
  const t = raw.trim();
  if (/^\d{1,10}$/.test(t)) return Number(t);
  try {
    const u = new URL(t);
    const h = u.hostname.toLowerCase();
    if (h !== HOST && !h.endsWith('.' + HOST)) return null;
    const id = u.searchParams.get('id') ?? '';
    return /^\d{1,10}$/.test(id) ? Number(id) : null;
  } catch { return null; }
}

function cameraError(e: unknown): string {
  switch ((e as DOMException)?.name) {
    case 'NotAllowedError': case 'SecurityError': return 'Permiso de cámara denegado. Habilítalo en el candado de la barra o en Ajustes del teléfono.';
    case 'NotFoundError': case 'OverconstrainedError': return 'No hay cámara disponible en este dispositivo.';
    case 'NotReadableError': return 'La cámara está siendo usada por otra aplicación.';
    default: return 'No se pudo abrir la cámara.';
  }
}

/** Lector de QR de credenciales. Pide permiso de cámara (PC, Android o iOS); el video no sale del dispositivo. */
export default function Scanner({ onId, onClose }: { onId: (id: number) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [msg, setMsg] = useState('Solicitando acceso a la cámara…');

  useEffect(() => {
    let stream: MediaStream | null = null, raf = 0, alive = true, busy = false, last = 0;
    const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    const det = Ctor ? new Ctor({ formats: ['qr_code'] }) : null;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    const decode = async (v: HTMLVideoElement): Promise<string | null> => {
      if (det) { try { return (await det.detect(v))[0]?.rawValue ?? null; } catch { /* usa jsQR */ } }
      const s = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
      canvas.width = Math.round(v.videoWidth * s); canvas.height = Math.round(v.videoHeight * s);
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })?.data ?? null;
    };

    (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setMsg('Se necesita una conexión segura (HTTPS) para usar la cámara.'); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
      } catch (e) { setMsg(cameraError(e)); return; }
      if (!alive || !video.current) { stream.getTracks().forEach((t) => t.stop()); return; }
      video.current.srcObject = stream; await video.current.play().catch(() => undefined);
      setMsg('Apunta al código QR de la credencial.');
      const loop = async (ts: number) => {
        if (!alive) return;
        raf = requestAnimationFrame(loop);
        const v = video.current;
        if (busy || ts - last < 140 || !v || v.readyState < 2) return;
        last = ts; busy = true;
        try {
          const text = await decode(v);
          if (text) {
            const id = extractId(text);
            if (id) { alive = false; onId(id); } else setMsg('Ese QR no es de una credencial municipal. Sigue buscando…');
          }
        } finally { busy = false; }
      };
      raf = requestAnimationFrame(loop);
    })();
    return () => { alive = false; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [onId]);

  return (
    <Modal title="Escanear credencial" onClose={onClose}>
      <div className="scan"><video ref={video} playsInline muted /><span className="scan__frame" aria-hidden="true" /></div>
      <p role="status" className="muted">{msg}</p>
    </Modal>
  );
}
