import React, { useState } from 'react';

// Добавляем типы для возрастных групп и пола
type AgeGroup = 'teen' | 'young' | 'adult' | 'elderly';
type Gender = 'male' | 'female' | 'other';

const CreateOrderPage: React.FC = () => {
  const [formData, setFormData] = useState({
    table_number: '',
    payment_method: '',
    customer_name: '',
    customer_phone: '',
    customer_age_group: '' as AgeGroup,
    comment: '',
    is_urgent: false,
    total_amount: 0,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const newValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label htmlFor="table_number" className="block text-sm font-medium text-gray-700 dark:text-white">
          Номер стола
        </label>
        <input
          type="number"
          id="table_number"
          name="table_number"
          value={formData.table_number}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm dark:text-white dark:bg-gray-800"
        />
      </div>

      <div>
        <label htmlFor="customer_name" className="block text-sm font-medium text-gray-700 dark:text-white">
          Имя клиента
        </label>
        <input
          type="text"
          id="customer_name"
          name="customer_name"
          value={formData.customer_name}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm dark:text-white dark:bg-gray-800"
        />
      </div>

      <div>
        <label htmlFor="customer_phone" className="block text-sm font-medium text-gray-700 dark:text-white">
          Телефон клиента
        </label>
        <input
          type="tel"
          id="customer_phone"
          name="customer_phone"
          value={formData.customer_phone}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm dark:text-white dark:bg-gray-800"
        />
      </div>

      <div>
        <label htmlFor="customer_age_group" className="block text-sm font-medium text-gray-700 dark:text-white">
          Возрастная группа
        </label>
        <select
          id="customer_age_group"
          name="customer_age_group"
          value={formData.customer_age_group}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm dark:text-white dark:bg-gray-800"
        >
          <option value="">Выберите возрастную группу</option>
          <option value="teen">Подросток (13-17)</option>
          <option value="young">Молодой (18-30)</option>
          <option value="adult">Взрослый (31-60)</option>
          <option value="elderly">Пожилой (60+)</option>
        </select>
      </div>

      <div>
        <label htmlFor="payment_method" className="block text-sm font-medium text-gray-700 dark:text-white">
          Способ оплаты
        </label>
        <select
          id="payment_method"
          name="payment_method"
          value={formData.payment_method}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm dark:text-white dark:bg-gray-800"
        >
          <option value="">Выберите способ оплаты</option>
          <option value="CASH">Наличные</option>
          <option value="CARD">Карта</option>
        </select>
      </div>

      <div className="md:col-span-2">
        <label htmlFor="comment" className="block text-sm font-medium text-gray-700 dark:text-white">
          Комментарий к заказу
        </label>
        <textarea
          id="comment"
          name="comment"
          value={formData.comment}
          onChange={handleChange}
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm dark:text-white dark:bg-gray-800"
        />
      </div>

      <div className="md:col-span-2">
        <div className="flex items-center">
          <input
            type="checkbox"
            id="is_urgent"
            name="is_urgent"
            checked={formData.is_urgent}
            onChange={handleChange}
            className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
          />
          <label htmlFor="is_urgent" className="ml-2 block text-sm text-gray-700 dark:text-white">
            Срочный заказ
          </label>
        </div>
      </div>
    </div>
  );
};

export default CreateOrderPage; 