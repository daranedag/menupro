'use client';
import { useState } from 'react';
import { Button, Modal } from '../ui';
import { Smartphone } from 'lucide-react';

export default function MobilePreview({ menuId }) {
  const [showPreview, setShowPreview] = useState(false);
  
  // Vista previa siempre en modo claro
  const previewUrl = `/app/dashboard/menus/${menuId}/preview`;

  return (
    <>
      <Button variant="outline" onClick={() => setShowPreview(true)}>
        <Smartphone size={18} className="inline mr-2" />
        Vista móvil
      </Button>

      <Modal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        title="Vista Previa Móvil"
        size="xl"
      >
        <div className="flex justify-center">
          <div className="relative max-w-full" style={{ width: '375px', height: '667px' }}>
            {/* Phone Frame */}
            <div className="absolute inset-0 border-8 border-gray-800 rounded-[3rem] shadow-2xl overflow-hidden bg-white">
              {/* Notch */}
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-gray-800 rounded-b-2xl z-10"></div>
              
              {/* Screen */}
              <div className="w-full h-full pt-6">
                <iframe
                  src={previewUrl}
                  className="w-full h-full border-0"
                  title="Mobile Preview"
                />
              </div>
            </div>

            {/* Home Button */}
            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-12 h-12 border-4 border-gray-800 rounded-full"></div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Button variant="outline" onClick={() => setShowPreview(false)}>
            Cerrar
          </Button>
        </div>
      </Modal>
    </>
  );
}
