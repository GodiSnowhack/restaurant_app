import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface OrderCodeScannerProps {
  onCodeDetected: (code: string) => void;
  onClose: () => void;
}

const OrderCodeScanner: React.FC<OrderCodeScannerProps> = ({ onCodeDetected, onClose }) => {
  const [manualCode, setManualCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Инициализация сканера при монтировании компонента
    if (scannerContainerRef.current) {
      try {
        const scannerConfig = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };
        
        scannerRef.current = new Html5Qrcode("qr-reader");
        
        // Автоматический старт сканирования
        startScanner(scannerConfig);
      } catch (error) {
        console.error("Ошибка при инициализации сканера:", error);
        setErrorMessage("Не удалось инициализировать сканер. Пожалуйста, введите код вручную.");
      }
    }

    // Очистка при размонтировании
    return () => {
      if (scannerRef.current && isScanning) {
        try {
          scannerRef.current.stop();
        } catch (error) {
          console.error("Ошибка при остановке сканера:", error);
        }
      }
    };
  }, []);

  const startScanner = async (config: any) => {
    if (!scannerRef.current) return;

    const qrCodeSuccessCallback = (decodedText: string) => {
      stopScanner();
      onCodeDetected(decodedText);
    };

    const qrCodeErrorCallback = () => {
      // Ничего не делаем при ошибке сканирования отдельного фрейма
    };

    try {
      setIsScanning(true);
      await scannerRef.current.start(
        { facingMode: "environment" },
        config,
        qrCodeSuccessCallback,
        qrCodeErrorCallback
      );
    } catch (error) {
      console.error("Ошибка при запуске сканера:", error);
      setErrorMessage("Не удалось запустить сканер. Возможно, у приложения нет доступа к камере.");
      setIsScanning(false);
    }
  };

  const stopScanner = () => {
    if (scannerRef.current && isScanning) {
      try {
        scannerRef.current.stop();
        setIsScanning(false);
      } catch (error) {
        console.error("Ошибка при остановке сканера:", error);
      }
    }
  };

  const handleManualCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onCodeDetected(manualCode.trim());
    } else {
      setErrorMessage('Пожалуйста, введите код заказа');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold">Сканирование кода заказа</h2>
          <button 
            onClick={onClose}
            className="rounded-full p-1 hover:bg-gray-100"
          >
            <XMarkIcon className="h-6 w-6 text-gray-500" />
          </button>
        </div>
        
        <div className="p-4">
          {errorMessage && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
              {errorMessage}
            </div>
          )}
          
          <div className="mb-6">
            <div id="qr-reader" ref={scannerContainerRef} className="w-full h-64 bg-gray-100 rounded-lg overflow-hidden"></div>
            {isScanning && (
              <p className="text-sm text-gray-500 mt-2 text-center">
                Наведите камеру на QR-код заказа
              </p>
            )}
          </div>
          
          <div className="border-t pt-4">
            <p className="text-center text-gray-500 mb-4">или введите код вручную</p>
            
            <form onSubmit={handleManualCodeSubmit}>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Введите код заказа"
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={8}
                />
                <button
                  type="submit"
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md"
                >
                  OK
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderCodeScanner; 