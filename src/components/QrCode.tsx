import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function QrCode({ data, size = 220, label = 'Código QR' }: { data: string; size?: number; label?: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => { let on = true; QRCode.toDataURL(data, { margin: 1, width: size * 2, errorCorrectionLevel: 'M' }).then((u) => { if (on) setSrc(u); }).catch(() => undefined); return () => { on = false; }; }, [data, size]);
  return src ? <img className="qr" src={src} width={size} height={size} alt={label} /> : <div className="qr qr--wait" style={{ width: size, height: size }} />;
}
