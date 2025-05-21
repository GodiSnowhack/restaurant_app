import useSettingsStore from '../lib/settings-store';

/**
 * Форматирует цену с символом валюты
 * @param price Цена для форматирования
 * @param options Опции форматирования
 * @returns Отформатированная строка цены с символом валюты
 */
export const formatPrice = (price: number, currency: string = '₸'): string => {
  if (typeof price !== 'number') return '';
  
  return price.toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }) + ' ' + currency;
};

/**
 * Функция для форматирования цены с учетом текущих настроек валюты
 * Может использоваться внутри компонентов React с хуками
 * @param amount Сумма для форматирования
 * @param options Опции форматирования
 * @returns Отформатированная строка цены с символом валюты
 */
export const formatPriceWithSettings = (amount: number | null | undefined, options: { decimals?: number } = {}): string => {
  const { settings } = useSettingsStore.getState();
  const { decimals = 2 } = options;
  
  if (amount === null || amount === undefined) {
    return `0.${'0'.repeat(decimals)} ${settings.currency_symbol}`;
  }
  
  return `${Number(amount).toFixed(decimals)} ${settings.currency_symbol}`;
}; 