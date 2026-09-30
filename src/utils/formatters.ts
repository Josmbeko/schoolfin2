import { ChargeStatus, PaymentMethod, PaymentStatus, UserRole } from '../types';

export function formatCurrency(amount: number, currency: string = 'CDF'): string {
  if (isNaN(amount)) return '0 ' + currency;
  const formatted = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount);
  return `${formatted} ${currency}`;
}

export function formatDate(dateString?: string): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString?: string): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return dateString;
  }
}

export function getPaymentMethodLabel(method: PaymentMethod | string): string {
  switch (method) {
    case 'cash':
      return 'Espèces / Caisse';
    case 'mobile_money':
      return 'Mobile Money (M-Pesa, Orange, Airtel)';
    case 'bank_transfer':
      return 'Virement Bancaire';
    case 'check':
      return 'Chèque';
    case 'card':
      return 'Carte Bancaire';
    case 'advance':
      return "Déduction sur Avance de l'Élève";
    default:
      return 'Autre';
  }
}

export function getChargeStatusMeta(status: ChargeStatus): { label: string; bg: string; text: string } {
  switch (status) {
    case 'paid':
      return { label: 'Payé', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' };
    case 'partial':
      return { label: 'Partiel', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' };
    case 'overdue':
      return { label: 'En retard', bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700' };
    case 'cancelled':
      return { label: 'Annulé', bg: 'bg-slate-50 border-slate-200', text: 'text-slate-500' };
    case 'pending':
    default:
      return { label: 'En attente', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700' };
  }
}

export function getPaymentStatusMeta(status: PaymentStatus): { label: string; bg: string; text: string } {
  switch (status) {
    case 'posted':
      return { label: 'Validé', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' };
    case 'voided':
      return { label: 'Annulé', bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700' };
    case 'refunded':
      return { label: 'Remboursé', bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700' };
    default:
      return { label: status, bg: 'bg-slate-50 border-slate-200', text: 'text-slate-700' };
  }
}

export function getRoleLabel(role: UserRole): string {
  switch (role) {
    case 'admin':
      return 'Administrateur Général';
    case 'director':
      return 'Directeur des Études';
    case 'cashier':
      return 'Caissier Principal';
    case 'secretary':
      return 'Secrétaire Administratif';
    default:
      return role;
  }
}

export function exportToCSV(filename: string, rows: Record<string, unknown>[]): void {
  if (!rows || !rows.length) return;
  const separator = ';';
  const keys = Object.keys(rows[0]);
  const csvContent =
    '\uFEFF' + // BOM for Excel UTF-8
    keys.join(separator) +
    '\n' +
    rows
      .map(row =>
        keys
          .map(k => {
            const raw = row[k];
            if (raw === null || raw === undefined) return '';
            let str = String(raw);
            str = str.replace(/"/g, '""');
            if (str.includes(separator) || str.includes('\n')) {
              str = `"${str}"`;
            }
            return str;
          })
          .join(separator)
      )
      .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
