import React, { useState } from 'react';
import { ClipboardIcon, CheckIcon } from '@heroicons/react/24/outline';

interface OrderCodeProps {
  code: string;
}

const OrderCode: React.FC<OrderCodeProps> = ({ code }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <h2 className="text-lg font-medium mb-2">Код заказа</h2>
      <p className="text-sm text-gray-500 mb-3">
        Этот код может быть использован официантом для привязки заказа
      </p>
      
      <div className="flex">
        <div className="flex-1 bg-gray-50 p-3 rounded-l-md border border-gray-200 font-mono text-lg text-center">
          {code}
        </div>
        <button
          onClick={copyToClipboard}
          className="bg-primary hover:bg-primary-dark text-white p-3 rounded-r-md transition-colors"
          title="Копировать код"
        >
          {copied ? (
            <CheckIcon className="h-6 w-6" />
          ) : (
            <ClipboardIcon className="h-6 w-6" />
          )}
        </button>
      </div>
      
      {copied && (
        <p className="text-sm text-green-600 mt-2">
          Код скопирован в буфер обмена
        </p>
      )}
    </div>
  );
};

export default OrderCode; 