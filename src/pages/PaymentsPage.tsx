import React, { useState } from 'react';
import {
  CreditCard,
  Search,
  Download,
  Receipt as ReceiptIcon,
  Ban,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  PlusCircle,
  Wallet,
  Coins,
} from 'lucide-react';
import { Payment, School, Receipt, Student } from '../types';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getPaymentMethodLabel,
  getPaymentStatusMeta,
  exportToCSV,
} from '../utils/formatters';
import { SchoolService } from '../services/schoolService';
import { useAuth } from '../context/AuthContext';

interface PaymentsPageProps {
  school: School;
  payments: Payment[];
  students: Student[];
  onOpenPaymentModal: () => void;
  onViewReceipt: (receipt: Receipt) => void;
  onRefreshData: () => Promise<void>;
}

export const PaymentsPage: React.FC<PaymentsPageProps> = ({
  school,
  payments,
  students,
  onOpenPaymentModal,
  onViewReceipt,
  onRefreshData,
}) => {
  const { schoolId, currentUser, profile, role } = useAuth();
  const currency = school.currency || 'CDF';

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Void payment modal
  const [paymentToVoid, setPaymentToVoid] = useState<Payment | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);

  // Financial statistics
  const postedPayments = payments.filter(p => p.status === 'posted');
  const totalEncaissé = postedPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalDirectCashBank = postedPayments.reduce(
    (sum, p) => sum + (p.directAmountPaid !== undefined ? p.directAmountPaid : (p.paymentMethod !== 'advance' ? p.amount : 0)),
    0
  );
  const totalAdvanceDeducted = postedPayments.reduce(
    (sum, p) => sum + (p.advanceDeducted !== undefined ? p.advanceDeducted : (p.paymentMethod === 'advance' ? p.amount : 0)),
    0
  );

  const filteredPayments = payments.filter(p => {
    const matchesSearch =
      p.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.studentName && p.studentName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.matricule && p.matricule.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.targetMonth && p.targetMonth.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.createdByName && p.createdByName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesMethod = selectedMethod === 'all' || p.paymentMethod === selectedMethod;
    const matchesStatus = selectedStatus === 'all' || p.status === selectedStatus;

    return matchesSearch && matchesMethod && matchesStatus;
  });

  const handleConfirmVoidPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentToVoid || !voidReason.trim()) return;

    setVoiding(true);
    try {
      await SchoolService.voidPayment(
        schoolId,
        paymentToVoid.id,
        voidReason,
        currentUser?.uid || 'admin',
        currentUser?.email || profile?.email || 'admin@ecole.cd'
      );
      await onRefreshData();
      setPaymentToVoid(null);
      setVoidReason('');
      alert('Paiement annulé avec succès. Les soldes des frais correspondants ont été restaurés.');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erreur lors de l'annulation du paiement.");
    } finally {
      setVoiding(false);
    }
  };

  const handleExportCSV = () => {
    const rows = filteredPayments.map(p => ({
      N_Reçu: p.receiptNumber,
      Date_Versement: p.paymentDate,
      Matricule: p.matricule || '-',
      Élève: p.studentName || '-',
      Classe: p.className || '-',
      Objet_Libellé: p.targetMonth || '-',
      Montant_Total_Encaissé: p.amount,
      Montant_Espèces_Banque: p.directAmountPaid ?? (p.paymentMethod !== 'advance' ? p.amount : 0),
      Déduction_Avance: p.advanceDeducted ?? (p.paymentMethod === 'advance' ? p.amount : 0),
      Mode_Paiement: getPaymentMethodLabel(p.paymentMethod),
      Caissier: p.createdByName,
      Statut: p.status,
      Date_Création: p.createdAt,
    }));
    exportToCSV(`paiements_${school.schoolYear}`, rows);
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Journal des Paiements & Encaissements
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Historique de toutes les transactions financières, bordereaux, déductions sur avances et reçus officiels
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold px-3.5 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Exporter CSV
          </button>

          {['admin', 'director', 'cashier'].includes(role) && (
            <button
              onClick={onOpenPaymentModal}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              Nouveau Paiement
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards: Reconnaissance des encaissements et déductions d'avances */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase block">Total Encaissé Global</span>
            <span className="text-lg font-extrabold text-slate-900 font-mono">
              {formatCurrency(totalEncaissé, currency)}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase block">Dont Espèces & Banques</span>
            <span className="text-lg font-extrabold text-emerald-700 font-mono">
              {formatCurrency(totalDirectCashBank, currency)}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-xs flex items-center gap-3.5">
          <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-emerald-900 uppercase block">Dont Déductions sur Avances</span>
            <span className="text-lg font-extrabold text-emerald-900 font-mono">
              {formatCurrency(totalAdvanceDeducted, currency)}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="p-2.5 bg-slate-100 text-slate-700 rounded-xl">
            <ReceiptIcon className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase block">Reçus Validés Émis</span>
            <span className="text-lg font-extrabold text-slate-900 font-mono">
              {postedPayments.length} reçu(s)
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Rechercher par N° reçu, élève, matricule, libellé..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={selectedMethod}
            onChange={e => setSelectedMethod(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 outline-none"
          >
            <option value="all">Tous les modes de règlement</option>
            <option value="cash">Espèces</option>
            <option value="advance">Déduction sur Avance</option>
            <option value="mobile_money">Mobile Money</option>
            <option value="bank_transfer">Virement Bancaire</option>
            <option value="check">Chèque</option>
            <option value="card">Carte Bancaire</option>
          </select>

          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 outline-none"
          >
            <option value="all">Tous les statuts</option>
            <option value="posted">Validé (Posted)</option>
            <option value="voided">Annulé (Voided)</option>
            <option value="refunded">Remboursé (Refunded)</option>
          </select>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">N° Reçu</th>
                <th className="py-3 px-4">Date Règlement</th>
                <th className="py-3 px-4">Élève & Classe</th>
                <th className="py-3 px-4">Mode de Paiement</th>
                <th className="py-3 px-4">Caissier</th>
                <th className="py-3 px-4 text-right">Montant</th>
                <th className="py-3 px-4 text-center">Statut</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Aucune transaction de paiement trouvée.
                  </td>
                </tr>
              ) : (
                filteredPayments.map(payment => {
                  const statusMeta = getPaymentStatusMeta(payment.status);

                  return (
                    <tr key={payment.id} className="hover:bg-slate-50/70">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        <div>{payment.receiptNumber}</div>
                        {payment.targetMonth && (
                          <span className="inline-block mt-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-1.5 py-0.5 rounded">
                            {payment.targetMonth}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        {formatDate(payment.paymentDate)}
                        <span className="block text-[10px] text-slate-400">{formatDateTime(payment.createdAt)}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{payment.studentName}</div>
                        <div className="text-[11px] text-slate-500">
                          {payment.className} · {payment.matricule}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        <div className="flex items-center gap-1.5">
                          {payment.paymentMethod === 'advance' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                              <Wallet className="w-3 h-3 text-emerald-600" />
                              Déduction sur Avance
                            </span>
                          ) : (
                            <span>{getPaymentMethodLabel(payment.paymentMethod)}</span>
                          )}
                        </div>
                        {payment.advanceDeducted && payment.advanceDeducted > 0 && payment.directAmountPaid && payment.directAmountPaid > 0 && (
                          <span className="inline-block text-[10px] text-emerald-800 font-semibold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded mt-1">
                            Mixte : +{formatCurrency(payment.advanceDeducted, currency)} sur avance
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        {payment.createdByName}
                      </td>

                      <td className="py-3.5 px-4 text-right font-extrabold text-slate-900">
                        <div>{formatCurrency(payment.amount, currency)}</div>
                        {payment.advanceDeducted && payment.advanceDeducted > 0 && (
                          <span className="block text-[10px] text-emerald-700 font-semibold">
                            (dont {formatCurrency(payment.advanceDeducted, currency)} avance)
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${statusMeta.bg} ${statusMeta.text}`}
                        >
                          {statusMeta.label}
                        </span>
                        {payment.status === 'voided' && payment.voidReason && (
                          <span className="block text-[10px] text-rose-500 italic mt-0.5">
                            « {payment.voidReason} »
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              const r: Receipt = {
                                id: `rec_${payment.id}`,
                                schoolId: school.id,
                                receiptNumber: payment.receiptNumber,
                                paymentId: payment.id,
                                studentId: payment.studentId,
                                studentName: payment.studentName || 'Élève',
                                matricule: payment.matricule || '-',
                                className: payment.className || '',
                                amount: payment.amount,
                                amountInWords: '',
                                currency,
                                paymentMethod: getPaymentMethodLabel(payment.paymentMethod),
                                cashierName: payment.createdByName,
                                targetMonth: payment.targetMonth,
                                note: payment.note,
                                issuedAt: payment.createdAt,
                              };
                              onViewReceipt(r);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded font-semibold transition-colors cursor-pointer"
                          >
                            <ReceiptIcon className="w-3.5 h-3.5" />
                            Reçu
                          </button>

                          {['admin', 'director'].includes(role) && payment.status === 'posted' && (
                            <button
                              onClick={() => setPaymentToVoid(payment)}
                              title="Annuler le paiement avec justificatif légal"
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Void Payment Confirmation */}
      {paymentToVoid && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-rose-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Annuler le Paiement</h3>
                <p className="text-xs text-rose-200">{paymentToVoid.receiptNumber}</p>
              </div>
              <button
                onClick={() => setPaymentToVoid(null)}
                className="text-rose-300 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmVoidPayment} className="p-6 space-y-4">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertCircle className="w-4 h-4" />
                  Action Irréversible & Auditée
                </div>
                <p>
                  Ce paiement de <strong>{formatCurrency(paymentToVoid.amount, currency)}</strong> au nom de{' '}
                  <strong>{paymentToVoid.studentName}</strong> sera marqué comme <em>annulé</em>. Les montants
                  affectés aux frais seront recrédités comme impayés.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Motif Obligatoire de l'Annulation (Erreur de caisse, chèque sans provision, etc.) *
                </label>
                <textarea
                  rows={3}
                  required
                  value={voidReason}
                  onChange={e => setVoidReason(e.target.value)}
                  placeholder="Ex: Erreur de saisie de montant par le caissier / Rejet bancaire"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-rose-600"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setPaymentToVoid(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Retour
                </button>
                <button
                  type="submit"
                  disabled={voiding || !voidReason.trim()}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  {voiding ? 'Annulation en cours...' : "Confirmer l'Annulation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
