import React, { useState } from 'react';

// Добавляем типы для возрастных групп и пола
type AgeGroup = 'teen' | 'young' | 'adult' | 'elderly';
type Gender = 'male' | 'female' | 'other';

const [formData, setFormData] = useState({
  // ... existing fields ...
  customer_age_group: '' as AgeGroup,
  customer_gender: '' as Gender,
});

{/* Добавляем поля для возрастной группы и пола */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <div>
    <label htmlFor="customer_age_group" className="block text-sm font-medium text-gray-700">
      Возрастная группа клиента
    </label>
    <select
      id="customer_age_group"
      name="customer_age_group"
      value={formData.customer_age_group}
      onChange={handleChange}
      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
    >
      <option value="">Выберите возрастную группу</option>
      <option value="teen">Подросток (13-17)</option>
      <option value="young">Молодой (18-30)</option>
      <option value="adult">Взрослый (31-60)</option>
      <option value="elderly">Пожилой (60+)</option>
    </select>
  </div>

  <div>
    <label htmlFor="customer_gender" className="block text-sm font-medium text-gray-700">
      Пол клиента
    </label>
    <select
      id="customer_gender"
      name="customer_gender"
      value={formData.customer_gender}
      onChange={handleChange}
      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
    >
      <option value="">Выберите пол</option>
      <option value="male">Мужской</option>
      <option value="female">Женский</option>
      <option value="other">Другой</option>
    </select>
  </div>
</div> 