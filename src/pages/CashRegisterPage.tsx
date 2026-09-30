import React, { useState } from 'react';
import {
  Receipt as ReceiptIcon,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Lock,
  Calendar,
  AlertTriangle,
  Download,
  PlusCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { CashOperation, School } from '../types';
import { formatCurrency, formatDate, formatDateTime, getPaymentMethodLabel, exportToCSV } from '../utils/formatters';
import { SchoolService } from '../services/schoolService';
import { useAuth } from '../context/AuthContext';

interface CashRegisterPageProps {
  school: School;
  cashOperations: CashOperation[];
  onRefreshData: () => Promise<void>;
}

export const CashRegisterPage: React.FC<CashRegisterPageProps> = ({
  school,
  cashOperations,
  onRefreshData,
}) => {
  const { schoolId, currentUser, profile, role } = useAuth();
  const currency = school.currency || 'CDF';
  const today = new Date().toISOString().split('T')[0];

  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [closingSaving, setClosingSaving] = useState(false);

  // Closing form state
  const [openingBalance, setOpeningBalance] = useState<number>(500000);
  const [physicalCash, setPhysicalCash] = useState<number>(0);
  const [closingNotes, setClosingNotes] = useState<string>('');

  // Daily operations
  const dailyOps = cashOperations.filter(op => op.date === selectedDate);
  const totalInflows = dailyOps
    .filter(op => op.type === 'inflow')
    .reduce((sum, op) => sum + op.amount, 0);
  const totalOutflows = dailyOps
    .filter(op => op.type === 'outflow')
    .reduce((sum, op) => sum + op.amount, 0);

  const theoreticalBalance = openingBalance + totalInflows - totalOutflows;
  const currentDifference = physicalCash - theoreticalBalance;

  // Existing closing for selected day
  const dayClosing = dailyOps.find(op => op.type === 'closing');

  const handleExecuteClosing = async (e: React.FormEvent) => {
    e.preventDefault();
    setClosingSaving(true);
    try {
      await SchoolService.performCashClosing(
        schoolId,
        selectedDate,
        openingBalance,
        physicalCash,
        closingNotes,
        currentUser?.uid || 'cashier',
        currentUser?.email || profile?.email || 'caissier@ecole.cd'
      );
      await onRefreshData();
      setIsClosingModalOpen(false);
      alert('Clôture de caisse validée et consignée dans le journal d\'audit.');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur lors de la clôture');
    } finally {
      setClosingSaving(false);
    }
  };

  const handleExportCSV = () => {
    const rows = dailyOps.map(op => ({
      Date: op.date,
      Heure: op.createdAt,
      Type_Opération: op.type,
      Montant: op.amount,
      Mode_Paiement: op.paymentMethod ? getPaymentMethodLabel(op.paymentMethod) : '-',
      Référence: op.referenceId || '-',
      Agent: op.performedByName,
      Solde_Après: op.balanceAfter,
      Notes: op.notes || '-',
    }));
    exportToCSV(`journal_caisse_${selectedDate}`, rows);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Journal de Caisse & Clôtures Quotidiennes
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Suivi des entrées/sorties en espèces, vérification des écarts et arrêtés de comptes
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="text-xs font-semibold text-slate-800 outline-none bg-transparent"
            />
          </div>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold px-3.5 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Exporter Journal
          </button>

          {['admin', 'director', 'cashier'].includes(role) && !dayClosing && (
            <button
              onClick={() => {
                setPhysicalCash(theoreticalBalance);
                setIsClosingModalOpen(true);
              }}
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              Effectuer la Clôture du Jour
            </button>
          )}
        </div>
      </div>

      {/* Daily Cash Status Banner */}
      {dayClosing ? (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <span className="font-bold text-emerald-900 block">
                Caisse Clôturée pour la journée du {formatDate(selectedDate)}
              </span>
              <span className="text-emerald-700">
                Solde physique constaté : <strong>{formatCurrency(dayClosing.physicalCash || 0, currency)}</strong> ·{' '}
                Écart :{' '}
                <strong>
                  {dayClosing.cashDifference === 0
                    ? 'Aucun écart (0)'
                    : formatCurrency(dayClosing.cashDifference || 0, currency)}
                </strong>{' '}
                · Clôturé par {dayClosing.performedByName}
              </span>
            </div>
          </div>
          <span className="font-mono text-[11px] text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded">
            Arrêté validé
          </span>
        </div>
      ) : (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold block">Session de Caisse en cours</span>
              <span className="text-amber-800">
                Les encaissements du jour sont comptabilisés en continu. La clôture formelle doit être opérée en fin
                de service.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Daily Balance KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase">Solde Initial d'Ouverture</span>
          <div className="text-xl font-bold text-slate-900 mt-1">
            {formatCurrency(openingBalance, currency)}
          </div>
          <span className="text-[11px] text-slate-400">Fond de caisse déclaré</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase">Total Encaissements du Jour</span>
          <div className="text-xl font-bold text-emerald-600 mt-1">
            +{formatCurrency(totalInflows, currency)}
          </div>
          <span className="text-[11px] text-slate-400">
            {dailyOps.filter(o => o.type === 'inflow').length} transactions
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase">Décaissements / Annulations</span>
          <div className="text-xl font-bold text-rose-600 mt-1">
            -{formatCurrency(totalOutflows, currency)}
          </div>
          <span className="text-[11px] text-slate-400">Remboursements ou annulations</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase">Solde Théorique de Caisse</span>
          <div className="text-xl font-bold text-indigo-700 mt-1">
            {formatCurrency(theoreticalBalance, currency)}
          </div>
          <span className="text-[11px] text-slate-400">Calcul automatique du système</span>
        </div>
      </div>

      {/* Cash Operations Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 px-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Mouvements de Caisse du {formatDate(selectedDate)}</h3>
            <p className="text-xs text-slate-500">Chaque entrée ou sortie enregistrée</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Heure</th>
                <th className="py-3 px-4">Type de Mouvement</th>
                <th className="py-3 px-4">Mode</th>
                <th className="py-3 px-4">Référence / Pièce</th>
                <th className="py-3 px-4">Caissier</th>
                <th className="py-3 px-4">Observations</th>
                <th className="py-3 px-4 text-right">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dailyOps.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Aucun mouvement de caisse pour cette journée.
                  </td>
                </tr>
              ) : (
                dailyOps.map(op => {
                  const isInflow = op.type === 'inflow';
                  const isClosing = op.type === 'closing';

                  return (
                    <tr key={op.id} className="hover:bg-slate-50/70">
                      <td className="py-3.5 px-4 font-mono text-slate-500">
                        {op.createdAt.split('T')[1]?.substring(0, 5) || '-'}
                      </td>

                      <td className="py-3.5 px-4">
                        {isClosing ? (
                          <span className="font-semibold text-slate-900 flex items-center gap-1">
                            <Lock className="w-3.5 h-3.5 text-indigo-600" />
                            Clôture de Caisse
                          </span>
                        ) : isInflow ? (
                          <span className="font-semibold text-emerald-700 flex items-center gap-1">
                            <TrendingUp className="w-3.5 h-3.5" />
                            Encaissement
                          </span>
                        ) : op.type === 'opening' ? (
                          <span className="font-semibold text-blue-700">Fond Initial</span>
                        ) : (
                          <span className="font-semibold text-rose-700 flex items-center gap-1">
                            <TrendingDown className="w-3.5 h-3.5" />
                            Décaissement / Annulation
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-700 font-medium">
                        {op.paymentMethod ? getPaymentMethodLabel(op.paymentMethod) : '-'}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-medium text-slate-900">
                        {op.referenceId || '-'}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        {op.performedByName}
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 italic max-w-xs truncate">
                        {op.notes || '-'}
                      </td>

                      <td className="py-3.5 px-4 text-right font-bold">
                        <span
                          className={
                            isInflow
                              ? 'text-emerald-600'
                              : isClosing
                              ? 'text-slate-900'
                              : 'text-rose-600'
                          }
                        >
                          {isInflow ? '+' : op.type === 'outflow' ? '-' : ''}
                          {formatCurrency(op.amount, currency)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Perform Daily Closing */}
      {isClosingModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Clôture Formelle de Caisse</h3>
                <p className="text-xs text-slate-400">Journée du {formatDate(selectedDate)}</p>
              </div>
              <button
                onClick={() => setIsClosingModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecuteClosing} className="p-6 space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl space-y-2 text-xs border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-600">Solde Initial du matin :</span>
                  <strong>{formatCurrency(openingBalance, currency)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Encaissements :</span>
                  <strong className="text-emerald-600">+{formatCurrency(totalInflows, currency)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Décaissements / Annulations :</span>
                  <strong className="text-rose-600">-{formatCurrency(totalOutflows, currency)}</strong>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
                  <span>Solde Théorique Attendu :</span>
                  <span className="text-indigo-700">{formatCurrency(theoreticalBalance, currency)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Solde Physique Réel Constaté en Coffre ({currency}) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={physicalCash}
                  onChange={e => setPhysicalCash(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-base font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              {/* Difference readout */}
              <div
                className={`p-3 rounded-lg text-xs font-semibold flex items-center justify-between border ${
                  currentDifference === 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : currentDifference > 0
                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                <span>Écart de Caisse :</span>
                <span>
                  {currentDifference === 0
                    ? 'Écart Nul (Parfait)'
                    : `${currentDifference > 0 ? '+' : ''}${formatCurrency(currentDifference, currency)} (${
                        currentDifference > 0 ? 'Excédent' : 'Déficit'
                      })`}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Observations de Clôture (Explication de l'écart ou validation)
                </label>
                <textarea
                  rows={2}
                  value={closingNotes}
                  onChange={e => setClosingNotes(e.target.value)}
                  placeholder="Ex: Caisse vérifiée conforme avec le chef d'établissement"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-600"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsClosingModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={closingSaving}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
                >
                  {closingSaving ? 'Clôture en cours...' : 'Verrouiller & Clôturer la Journée'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
