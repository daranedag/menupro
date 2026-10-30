'use client';
import { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Button, Modal } from '../ui';
import { QrCode, Copy, Download } from 'lucide-react';
import { useMenuLink } from './useMenuLink';

export default function QRGenerator({ menuId, menuName }) {
  const [showQR, setShowQR] = useState(false);
  
  // URL del menú público
  const { url: menuUrl, isPublished } = useMenuLink(menuId);

  const downloadQR = () => {
    const canvas = document.getElementById('qr-code-canvas');
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${menuName.replace(/\s+/g, '_')}_QR.png`;
      link.href = url;
      link.click();
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(menuUrl);
    alert('¡Link copiado al portapapeles!');
  };

  return (
    <>
      <Button variant="outline" disabled={!menuUrl} onClick={() => setShowQR(true)}>
        <QrCode size={18} className="inline mr-2" />
        Generar QR
      </Button>

      <Modal
        isOpen={showQR}
        onClose={() => setShowQR(false)}
        title="Código QR del Menú"
      >
        <div className="text-center">
          {!isPublished && <p role="status" className="mb-4 rounded-lg bg-amber-50 p-3 text-amber-800">Publica la carta para que tus clientes puedan abrir este QR.</p>}
          <p className="text-gray-600 mb-6">
            Escanea este código QR para acceder al menú digital
          </p>
          
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-white border-4 border-gray-200 rounded-lg">
              <QRCodeCanvas
                id="qr-code-canvas"
                value={menuUrl}
                size={256}
                level="H"
                includeMargin={true}
              />
            </div>
          </div>

          <div className="mb-6">
            <p className="text-sm text-gray-500 mb-2">Link del menú:</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={menuUrl}
                readOnly
                className="flex-1 px-3 py-2 border rounded-lg text-sm bg-gray-50"
              />
              <Button variant="outline" size="sm" onClick={copyLink}>
                <Copy size={16} className="inline mr-1" />
                Copiar
              </Button>
            </div>
          </div>

          <div className="flex gap-3 justify-center">
            <Button variant="primary" onClick={downloadQR}>
              <Download size={18} className="inline mr-2" />
              Descargar QR
            </Button>
            <Button variant="outline" onClick={() => setShowQR(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
