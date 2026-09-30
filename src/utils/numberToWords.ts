import { Currency } from '../types';

const UNITS: string[] = [
  '', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'dix-sept', 'dix-huit', 'dix-neuf'
];

const TENS: string[] = [
  '', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante',
  'soixante-dix', 'quatre-vingts', 'quatre-vingt-dix'
];

function convertBelowThousand(n: number): string {
  if (n === 0) return '';
  let result = '';

  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;

  if (hundreds > 0) {
    if (hundreds === 1) {
      result += 'cent';
    } else {
      result += UNITS[hundreds] + ' cent' + (remainder === 0 ? 's' : '');
    }
    if (remainder > 0) result += ' ';
  }

  if (remainder > 0) {
    if (remainder < 20) {
      result += UNITS[remainder];
    } else if (remainder < 70) {
      const ten = Math.floor(remainder / 10);
      const unit = remainder % 10;
      if (unit === 1 && ten < 8) {
        result += TENS[ten] + ' et un';
      } else if (unit > 0) {
        result += TENS[ten] + '-' + UNITS[unit];
      } else {
        result += TENS[ten];
      }
    } else if (remainder < 80) {
      // 70 - 79
      const unit = remainder % 10;
      if (unit === 1) {
        result += 'soixante et onze';
      } else {
        result += 'soixante-' + UNITS[10 + unit];
      }
    } else if (remainder < 90) {
      // 80 - 89
      const unit = remainder % 10;
      if (unit === 0) {
        result += 'quatre-vingts';
      } else {
        result += 'quatre-vingt-' + UNITS[unit];
      }
    } else {
      // 90 - 99
      const unit = remainder % 10;
      result += 'quatre-vingt-' + UNITS[10 + unit];
    }
  }

  return result.trim();
}

export function numberToWords(amount: number, currency: Currency | string = 'CDF'): string {
  if (isNaN(amount) || amount === 0) {
    return `Zéro ${getCurrencyName(currency, 0)}`;
  }

  const isNegative = amount < 0;
  const absAmount = Math.abs(Math.floor(amount));

  const billions = Math.floor(absAmount / 1_000_000_000);
  const millions = Math.floor((absAmount % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((absAmount % 1_000_000) / 1_000);
  const units = absAmount % 1_000;

  const parts: string[] = [];

  if (billions > 0) {
    parts.push(billions === 1 ? 'un milliard' : `${convertBelowThousand(billions)} milliards`);
  }

  if (millions > 0) {
    parts.push(millions === 1 ? 'un million' : `${convertBelowThousand(millions)} millions`);
  }

  if (thousands > 0) {
    if (thousands === 1) {
      parts.push('mille');
    } else {
      parts.push(`${convertBelowThousand(thousands)} mille`);
    }
  }

  if (units > 0) {
    parts.push(convertBelowThousand(units));
  }

  const words = (isNegative ? 'moins ' : '') + parts.join(' ');
  const capitalized = words.charAt(0).toUpperCase() + words.slice(1);
  const currencyStr = getCurrencyName(currency, absAmount);

  return `${capitalized} ${currencyStr}`.trim();
}

function getCurrencyName(currency: string, amount: number): string {
  switch (currency.toUpperCase()) {
    case 'CDF':
      return amount > 1 ? 'francs congolais' : 'franc congolais';
    case 'USD':
      return amount > 1 ? 'dollars américains' : 'dollar américain';
    case 'EUR':
      return amount > 1 ? 'euros' : 'euro';
    default:
      return currency;
  }
}
