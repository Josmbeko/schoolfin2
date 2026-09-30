import React, { useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  AlertOctagon,
  CreditCard,
  Calendar,
  Users,
  Clock,
  ArrowUpRight,
  PlusCircle,
  FileCheck,
  Filter,
  Download,
  Search,
  X,
  ExternalLink,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { StatCard } from '../components/common/StatCard';
import { Student, StudentCharge, Payment, School, Receipt, ClassItem, SectionItem, FeeType } from '../types';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getPaymentMethodLabel,
  getPaymentStatusMeta,
  exportToCSV,
} from '../utils/formatters';
import { PROMOTIONS_LIST } from '../utils/academic';

interface DashboardPageProps {
  school: School;
  students: Student[];
  charges: StudentCharge[];
  payments: Payment[];
  classes?: ClassItem[];
  sections?: SectionItem[];
  feeTypes?: FeeType[];
  onOpenPaymentModal: (student?: Student) => void;
  onNavigateTo: (tab: any) => void;
  onViewReceipt: (receipt: Receipt) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  school,
  students,
  charges,
  payments,
  classes = [],
  sections = [],
  feeTypes = [],
  onOpenPaymentModal,
  onNavigateTo,
  onViewReceipt,
}) => {
  const currency = school.currency || 'CDF';
  const today = new Date().toISOString().split('T')[0];

  // Financial calculations
  const totalBilled = charges.reduce((acc, c) => acc + (c.status !== 'cancelled' ? c.netAmount : 0), 0);
  const totalCollected = payments.reduce((acc, p) => acc + (p.status === 'posted' ? p.amount : 0), 0);
  const totalRemaining = Math.max(0, totalBilled - totalCollected);
  const totalAdvances = students.reduce((acc, s) => acc + (s.creditAdvance || 0), 0);

  const todayPayments = payments.filter(p => p.status === 'posted' && p.paymentDate === today);
  const todayInflow = todayPayments.reduce((acc, p) => acc + p.amount, 0);

  const recoveryRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

  // Breakdown by payment method
  const methodTotals: { [key: string]: number } = {};
  payments.filter(p => p.status === 'posted').forEach(p => {
    methodTotals[p.paymentMethod] = (methodTotals[p.paymentMethod] || 0) + p.amount;
  });

  // Recent 6 transactions
  const recentPayments = [...payments]
    .filter(p => p.status === 'posted')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  // Overdue and unpaid charges
  const overdueCharges = charges.filter(
    c => c.status !== 'cancelled' && c.netAmount - c.paidAmount > 0 && (c.status === 'overdue' || c.dueDate <= today)
  );

  // Modal State for Overdue Details
  const [showOverdueModal, setShowOverdueModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClassId, setFilterClassId] = useState('all');
  const [filterFeeLabel, setFilterFeeLabel] = useState('all');
  const [filterSection, setFilterSection] = useState('all');
  const [filterPromotion, setFilterPromotion] = useState('all');
  const [sortAmountBy, setSortAmountBy] = useState<'highest_remaining' | 'lowest_remaining' | 'highest_paid' | 'oldest'>('highest_remaining');

  // Extract unique labels for filter dropdown
  const uniqueFeeLabels = Array.from(new Set(overdueCharges.map(c => c.label))).filter(Boolean);

  // Filtered overdue charges
  const filteredOverdueCharges = overdueCharges
    .map(charge => {
      const student = students.find(s => s.id === charge.studentId);
      const studentClass = classes.find(c => c.id === charge.classId || c.id === student?.classId);
      const remaining = Math.max(0, charge.netAmount - charge.paidAmount);

      return {
        ...charge,
        student,
        studentClass,
        remaining,
      };
    })
    .filter(item => {
      const studentName = item.studentName || `${item.student?.lastName || ''} ${item.student?.firstName || ''}`;
      const matricule = item.matricule || item.student?.matricule || '';
      const matchesSearch =
        studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        matricule.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.label.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesClass = filterClassId === 'all' || item.classId === filterClassId || item.student?.classId === filterClassId;
      const matchesFeeLabel = filterFeeLabel === 'all' || item.label === filterFeeLabel;

      const sectionName = item.studentClass?.section || '';
      const matchesSection = filterSection === 'all' || sectionName === filterSection;

      const promotionLevel = item.studentClass?.level || item.studentClass?.name || '';
      const matchesPromotion =
        filterPromotion === 'all' ||
        promotionLevel.toLowerCase().includes(filterPromotion.toLowerCase()) ||
        (item.studentClass && item.studentClass.name.toLowerCase().includes(filterPromotion.toLowerCase()));

      return matchesSearch && matchesClass && matchesFeeLabel && matchesSection && matchesPromotion;
    })
    .sort((a, b) => {
      if (sortAmountBy === 'highest_remaining') return b.remaining - a.remaining;
      if (sortAmountBy === 'lowest_remaining') return a.remaining - b.remaining;
      if (sortAmountBy === 'highest_paid') return b.paidAmount - a.paidAmount;
      if (sortAmountBy === 'oldest') return a.dueDate.localeCompare(b.dueDate);
      return 0;
    });

  // Calculate totals of filtered list
  const filteredTotalRemaining = filteredOverdueCharges.reduce((acc, c) => acc + c.remaining, 0);
  const filteredTotalPaid = filteredOverdueCharges.reduce((acc, c) => acc + c.paidAmount, 0);

  const handleExportOverdueCSV = () => {
    const rows = filteredOverdueCharges.map(c => ({
      Matricule: c.matricule || c.student?.matricule || '-',
      Élève: c.studentName || `${c.student?.lastName} ${c.student?.firstName}` || '-',
      Classe: c.studentClass?.name || '-',
      Section: c.studentClass?.section || '-',
      Frais: c.label,
      Date_Échéance: c.dueDate,
      Montant_Net: c.netAmount,
      Montant_Payé: c.paidAmount,
      Reste_À_Recouvrer: c.remaining,
    }));
    exportToCSV(`factures_en_retard_${school.schoolYear}`, rows);
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900 text-white p-4 sm:p-6 rounded-2xl shadow-sm">
        <div>
          <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
            Tableau de Bord Financier
          </span>
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-white mt-0.5">
            {school.name} — Exercice {school.schoolYear}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {students.length} élèves inscrits · Taux de recouvrement global :{' '}
            <strong className="text-emerald-400">{recoveryRate}%</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onOpenPaymentModal()}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            Encaisser un Paiement
          </button>
          <button
            onClick={() => onNavigateTo('billing')}
            className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3.5 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <FileCheck className="w-4 h-4" />
            Échéancier & Factures
          </button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Facturé"
          value={formatCurrency(totalBilled, currency)}
          subtitle={`${charges.length} obligations de frais`}
          highlightColor="indigo"
          icon={<DollarSign className="w-5 h-5" />}
        />

        <StatCard
          title="Total Encaissé"
          value={formatCurrency(totalCollected, currency)}
          trend={{ label: `${recoveryRate}% recouvré`, isPositive: recoveryRate >= 70 }}
          subtitle={`${payments.filter(p => p.status === 'posted').length} transactions validées`}
          highlightColor="emerald"
          icon={<TrendingUp className="w-5 h-5" />}
        />

        {/* Enhanced Interactive Reste à Recouvrer Card */}
        <div className="bg-white border-2 border-rose-200 rounded-xl p-5 shadow-xs flex flex-col justify-between transition-all hover:border-rose-300 relative group">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider">
              Reste à Recouvrer
            </span>
            <div className="p-2 rounded-lg border text-rose-600 bg-rose-50 border-rose-200">
              <AlertOctagon className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {formatCurrency(totalRemaining, currency)}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-rose-600">{overdueCharges.length} factures en retard</span>
            </div>
          </div>

          {/* Interactive Button to View Details */}
          <div className="mt-4 pt-3 border-t border-rose-100">
            <button
              onClick={() => setShowOverdueModal(true)}
              className="w-full inline-flex items-center justify-between text-xs font-bold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100/80 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <span>Détails des factures en retard</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>

        <StatCard
          title="Recette du Jour"
          value={formatCurrency(todayInflow, currency)}
          subtitle={`${todayPayments.length} encaissements aujourd'hui`}
          highlightColor="amber"
          icon={<Clock className="w-5 h-5" />}
        />
      </div>

      {/* Secondary Metric Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Élèves Actifs</div>
              <div className="text-lg font-bold text-slate-900">{students.filter(s => s.status === 'active').length}</div>
            </div>
          </div>
          <button
            onClick={() => onNavigateTo('students')}
            className="text-xs text-indigo-600 font-semibold hover:underline cursor-pointer"
          >
            Consulter
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Avances & Crédits Élèves</div>
              <div className="text-lg font-bold text-emerald-700">{formatCurrency(totalAdvances, currency)}</div>
            </div>
          </div>
          <span className="text-[11px] text-slate-400">Fonds en réserve</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Paiements par Mobile Money</div>
              <div className="text-lg font-bold text-slate-900">
                {formatCurrency(methodTotals['mobile_money'] || 0, currency)}
              </div>
            </div>
          </div>
          <span className="text-[11px] text-slate-400">M-Pesa / Orange</span>
        </div>
      </div>

      {/* Middle Visual Section: Breakdown & Recent Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Transactions Table */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 sm:px-6 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Derniers Encaissements & Reçus</h3>
              <p className="text-xs text-slate-500">Flux d'entrée en caisse en temps réel</p>
            </div>
            <button
              onClick={() => onNavigateTo('payments')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
            >
              Voir tout ({payments.length})
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">N° Reçu</th>
                  <th className="py-3 px-4">Élève & Classe</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4 text-right">Montant</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentPayments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Aucun paiement enregistré pour l'instant.
                    </td>
                  </tr>
                ) : (
                  recentPayments.map(p => {
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-slate-900">
                          {p.receiptNumber}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-800 block">{p.studentName}</span>
                          <span className="text-[11px] text-slate-500">{p.className || p.matricule}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {getPaymentMethodLabel(p.paymentMethod)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          {formatCurrency(p.amount, currency)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => {
                              const r: Receipt = {
                                id: `rec_${p.id}`,
                                schoolId: school.id,
                                receiptNumber: p.receiptNumber,
                                paymentId: p.id,
                                studentId: p.studentId,
                                studentName: p.studentName || 'Élève',
                                matricule: p.matricule || '-',
                                className: p.className || 'Classe',
                                amount: p.amount,
                                amountInWords: '',
                                currency,
                                targetMonth: p.targetMonth,
                                paymentMethod: getPaymentMethodLabel(p.paymentMethod),
                                cashierName: p.createdByName || 'Caissier',
                                issuedAt: p.createdAt,
                              };
                              onViewReceipt(r);
                            }}
                            className="px-2.5 py-1 text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded font-medium transition-colors cursor-pointer"
                          >
                            Reçu
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 1 Col: Payment Methods Breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">Modes d'Encaissement</h3>
            <p className="text-xs text-slate-500 mb-4">Répartition des recettes validées</p>

            <div className="space-y-3">
              {[
                { key: 'cash', label: 'Espèces / Caisse', color: 'bg-emerald-500' },
                { key: 'mobile_money', label: 'Mobile Money', color: 'bg-amber-500' },
                { key: 'bank_transfer', label: 'Virement Bancaire', color: 'bg-indigo-500' },
                { key: 'check', label: 'Chèque', color: 'bg-slate-400' },
              ].map(m => {
                const total = methodTotals[m.key] || 0;
                const pct = totalCollected > 0 ? Math.round((total / totalCollected) * 100) : 0;
                return (
                  <div key={m.key}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-slate-700">{m.label}</span>
                      <span className="font-semibold text-slate-900">
                        {formatCurrency(total, currency)} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className={`h-full ${m.color} rounded-full`} style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <button
              onClick={() => onNavigateTo('cash')}
              className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Consulter le Journal de Caisse
            </button>
          </div>
        </div>
      </div>

      {/* OVERDUE INVOICES MODAL (RESTE A RECOUVRER DETAILED VIEW) */}
      {showOverdueModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full overflow-hidden border border-slate-200 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-rose-950 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-600 rounded-xl">
                  <AlertOctagon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Détails des Factures & Frais en Retard (Reste à Recouvrer)</h3>
                  <p className="text-xs text-rose-200">
                    {overdueCharges.length} factures échues impayées · Total global à recouvrer :{' '}
                    <strong className="text-white font-bold">{formatCurrency(totalRemaining, currency)}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowOverdueModal(false)}
                className="text-rose-300 hover:text-white p-1 rounded-lg hover:bg-rose-900/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Quick Counters Banner */}
            <div className="bg-rose-50/70 border-b border-rose-100 px-6 py-3 flex flex-wrap items-center justify-between gap-4 shrink-0 text-xs">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-slate-500">Factures filtrées :</span>{' '}
                  <strong className="text-slate-900 font-bold text-sm">{filteredOverdueCharges.length}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Reste à recouvrer filtré :</span>{' '}
                  <strong className="text-rose-700 font-bold text-sm">
                    {formatCurrency(filteredTotalRemaining, currency)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Déjà payé sur ces frais :</span>{' '}
                  <strong className="text-emerald-700 font-bold text-sm">
                    {formatCurrency(filteredTotalPaid, currency)}
                  </strong>
                </div>
              </div>

              <button
                onClick={handleExportOverdueCSV}
                className="inline-flex items-center gap-1.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg font-semibold shadow-2xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                Exporter CSV
              </button>
            </div>

            {/* Filters Bar */}
            <div className="p-4 border-b border-slate-200 bg-white space-y-3 shrink-0">
              <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
                <div className="relative w-full md:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Élève, matricule, frais..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:bg-white focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto text-xs">
                  {/* Filter by Section */}
                  <select
                    value={filterSection}
                    onChange={e => setFilterSection(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none font-medium"
                  >
                    <option value="all">Toutes sections</option>
                    <option value="Maternelle">Maternelle</option>
                    <option value="Primaire">Primaire</option>
                    <option value="Éducation de Base">Éducation de Base</option>
                    <option value="Secondaire">Secondaire</option>
                  </select>

                  {/* Filter by Classe */}
                  <select
                    value={filterClassId}
                    onChange={e => setFilterClassId(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none font-medium"
                  >
                    <option value="all">Toutes classes</option>
                    {classes.map(c => (
                      <option key={`ov_cls_${c.id}`} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  {/* Filter by Libellé de Frais */}
                  <select
                    value={filterFeeLabel}
                    onChange={e => setFilterFeeLabel(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none font-medium max-w-[160px] truncate"
                  >
                    <option value="all">Tous libellés</option>
                    {uniqueFeeLabels.map(lbl => (
                      <option key={`ov_lbl_${lbl}`} value={lbl}>
                        {lbl}
                      </option>
                    ))}
                  </select>

                  {/* Filter by Promotion */}
                  <select
                    value={filterPromotion}
                    onChange={e => setFilterPromotion(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none font-medium"
                  >
                    <option value="all">Toutes promotions</option>
                    {PROMOTIONS_LIST.map(p => (
                      <option key={`ov_prm_${p}`} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>

                  {/* Sort by Amount */}
                  <select
                    value={sortAmountBy}
                    onChange={e => setSortAmountBy(e.target.value as any)}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none font-semibold text-rose-700"
                  >
                    <option value="highest_remaining">Reste dû (Décroissant)</option>
                    <option value="lowest_remaining">Reste dû (Croissant)</option>
                    <option value="highest_paid">Montant payé (Décroissant)</option>
                    <option value="oldest">Date d'échéance (Plus ancien)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Overdue Invoices Table */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredOverdueCharges.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-600">Aucune facture en retard correspondant aux filtres</p>
                  <p className="text-xs text-slate-400 mt-1">Tous les élèves sont à jour pour les critères sélectionnés.</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Élève & Matricule</th>
                      <th className="py-2.5 px-3">Classe & Section</th>
                      <th className="py-2.5 px-3">Frais / Échéance</th>
                      <th className="py-2.5 px-3 text-right">Net Dû</th>
                      <th className="py-2.5 px-3 text-right">Montant Payé</th>
                      <th className="py-2.5 px-3 text-right">Reste à Payer</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOverdueCharges.map(item => {
                      const studentObj = item.student || students.find(s => s.id === item.studentId);
                      return (
                        <tr key={item.id} className="hover:bg-rose-50/40 transition-colors">
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-900 block">
                              {item.studentName || `${studentObj?.lastName} ${studentObj?.firstName}`}
                            </span>
                            <span className="font-mono text-[11px] text-slate-500">
                              {item.matricule || studentObj?.matricule || '-'}
                            </span>
                          </td>

                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-slate-800 block">
                              {item.studentClass?.name || studentObj?.className || 'Classe non définie'}
                            </span>
                            <span className="text-[11px] text-indigo-600 font-medium">
                              {item.studentClass?.section || 'Section standard'}
                            </span>
                          </td>

                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-slate-900 block">{item.label}</span>
                            <span className="text-[11px] text-rose-600 font-medium">
                              Échéance : {formatDate(item.dueDate)}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-right text-slate-600 font-medium">
                            {formatCurrency(item.netAmount, currency)}
                          </td>

                          <td className="py-2.5 px-3 text-right text-emerald-700 font-semibold">
                            {formatCurrency(item.paidAmount, currency)}
                          </td>

                          <td className="py-2.5 px-3 text-right font-extrabold text-rose-600 text-sm">
                            {formatCurrency(item.remaining, currency)}
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => {
                                setShowOverdueModal(false);
                                if (studentObj) {
                                  onOpenPaymentModal(studentObj);
                                }
                              }}
                              className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-2.5 py-1 rounded-lg text-xs shadow-2xs transition-colors cursor-pointer"
                            >
                              <PlusCircle className="w-3.5 h-3.5" />
                              Encaisser
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500">
                Cliquez sur <strong>Encaisser</strong> pour régulariser immédiatement l'élève dans la caisse
              </span>
              <button
                type="button"
                onClick={() => setShowOverdueModal(false)}
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
