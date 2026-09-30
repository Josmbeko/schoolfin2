import React, { useState } from 'react';
import {
  FileText,
  Calendar,
  Sparkles,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Download,
} from 'lucide-react';
import { StudentCharge, ClassItem, FeeType, School, Student } from '../types';
import { formatCurrency, formatDate, getChargeStatusMeta, exportToCSV } from '../utils/formatters';
import { SchoolService } from '../services/schoolService';
import { useAuth } from '../context/AuthContext';

interface BillingPageProps {
  school: School;
  charges: StudentCharge[];
  classes: ClassItem[];
  feeTypes: FeeType[];
  students: Student[];
  onRefreshData: () => Promise<void>;
}

export const BillingPage: React.FC<BillingPageProps> = ({
  school,
  charges,
  classes,
  feeTypes,
  students,
  onRefreshData,
}) => {
  const { schoolId, currentUser, profile, role } = useAuth();
  const currency = school.currency || 'CDF';

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Generation Wizard Form State
  const [wizardForm, setWizardForm] = useState<{
    classId: string;
    feeTypeId: string;
    label: string;
    dueDate: string;
    amount: number;
  }>({
    classId: classes[0]?.id || '',
    feeTypeId: feeTypes[0]?.id || '',
    label: 'Minerval - Novembre 2026',
    dueDate: '2026-11-15',
    amount: 85000,
  });

  const handleGenerateCharges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wizardForm.classId || !wizardForm.label || wizardForm.amount <= 0) return;

    setGenerating(true);
    try {
      const generatedCount = await SchoolService.generateChargesForClass(
        schoolId,
        wizardForm.classId,
        wizardForm.feeTypeId,
        wizardForm.label,
        wizardForm.dueDate,
        wizardForm.amount,
        school.schoolYear,
        currentUser?.uid || 'admin',
        currentUser?.email || profile?.email || 'admin@ecole.cd'
      );
      await onRefreshData();
      setIsWizardOpen(false);
      alert(`Génération réussie ! ${generatedCount} factures créées pour les élèves de la classe.`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur lors de la facturation');
    } finally {
      setGenerating(false);
    }
  };

  const filteredCharges = charges.filter(c => {
    const matchesSearch =
      c.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.studentName && c.studentName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.matricule && c.matricule.toLowerCase().includes(searchTerm.toLowerCase()));

    const studentObj = students.find(s => s.id === c.studentId);
    const matchesClass = selectedClassId === 'all' || studentObj?.classId === selectedClassId;
    const matchesStatus = selectedStatus === 'all' || c.status === selectedStatus;

    return matchesSearch && matchesClass && matchesStatus;
  });

  const handleExportCSV = () => {
    const rows = filteredCharges.map(c => ({
      Matricule: c.matricule || '-',
      Élève: c.studentName || '-',
      Libellé_Frais: c.label,
      Date_Échéance: c.dueDate,
      Montant_Brut: c.amountDue,
      Remise: c.discountAmount,
      Net_Dû: c.netAmount,
      Montant_Payé: c.paidAmount,
      Reste_À_Payer: Math.max(0, c.netAmount - c.paidAmount),
      Statut: c.status,
    }));
    exportToCSV(`facturations_${school.schoolYear}`, rows);
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Facturation des Frais & Échéancier
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Génération en masse des échéances mensuelles, trimestrielles et suivi des obligations
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold px-3.5 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Exporter Factures
          </button>

          {['admin', 'director'].includes(role) && (
            <button
              onClick={() => setIsWizardOpen(true)}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Générer une Échéance par Classe
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Rechercher par libellé frais, élève, matricule..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={selectedClassId}
            onChange={e => setSelectedClassId(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 outline-none"
          >
            <option value="all">Toutes les classes</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 outline-none"
          >
            <option value="all">Tous les statuts</option>
            <option value="paid">Payé</option>
            <option value="partial">Partiel</option>
            <option value="pending">En attente</option>
            <option value="overdue">En retard</option>
          </select>
        </div>
      </div>

      {/* Charges Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Élève & Matricule</th>
                <th className="py-3 px-4">Libellé Frais</th>
                <th className="py-3 px-4">Date Limite</th>
                <th className="py-3 px-4 text-right">Montant Brut</th>
                <th className="py-3 px-4 text-right">Remise</th>
                <th className="py-3 px-4 text-right">Net Dû</th>
                <th className="py-3 px-4 text-right">Encaissé</th>
                <th className="py-3 px-4 text-right">Reste</th>
                <th className="py-3 px-4 text-center">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCharges.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Aucune obligation de frais enregistrée.
                  </td>
                </tr>
              ) : (
                filteredCharges.map(charge => {
                  const statusMeta = getChargeStatusMeta(charge.status);
                  const remaining = Math.max(0, charge.netAmount - charge.paidAmount);

                  return (
                    <tr key={charge.id} className="hover:bg-slate-50/70">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{charge.studentName || '-'}</div>
                        <div className="font-mono text-[11px] text-slate-400">{charge.matricule || '-'}</div>
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {charge.label}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        {formatDate(charge.dueDate)}
                      </td>

                      <td className="py-3.5 px-4 text-right text-slate-500">
                        {formatCurrency(charge.amountDue, currency)}
                      </td>

                      <td className="py-3.5 px-4 text-right text-amber-600">
                        {charge.discountAmount > 0 ? `-${formatCurrency(charge.discountAmount, currency)}` : '-'}
                      </td>

                      <td className="py-3.5 px-4 text-right font-semibold text-slate-900">
                        {formatCurrency(charge.netAmount, currency)}
                      </td>

                      <td className="py-3.5 px-4 text-right text-emerald-600 font-semibold">
                        {formatCurrency(charge.paidAmount, currency)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-bold text-rose-600">
                        {formatCurrency(remaining, currency)}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${statusMeta.bg} ${statusMeta.text}`}
                        >
                          {statusMeta.label}
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

      {/* Mass Generation Wizard Modal */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Générateur d'Échéances en Masse</h3>
                <p className="text-xs text-slate-400">
                  Génère automatiquement la facture pour tous les élèves actifs de la classe
                </p>
              </div>
              <button
                onClick={() => setIsWizardOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGenerateCharges} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Classe Cible *
                </label>
                <select
                  required
                  value={wizardForm.classId}
                  onChange={e => {
                    const cId = e.target.value;
                    const cls = classes.find(c => c.id === cId);
                    setWizardForm({
                      ...wizardForm,
                      classId: cId,
                      amount: cls?.monthlyFee || wizardForm.amount,
                    });
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({students.filter(s => s.classId === c.id).length} élèves)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Type de Frais Associé *
                </label>
                <select
                  required
                  value={wizardForm.feeTypeId}
                  onChange={e => {
                    const fId = e.target.value;
                    const ft = feeTypes.find(f => f.id === fId);
                    setWizardForm({
                      ...wizardForm,
                      feeTypeId: fId,
                      label: ft?.name || wizardForm.label,
                      amount: ft?.amount || wizardForm.amount,
                    });
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  {feeTypes.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name} — {formatCurrency(f.amount, currency)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Libellé sur la Facture Élève *
                </label>
                <input
                  type="text"
                  required
                  value={wizardForm.label}
                  onChange={e => setWizardForm({ ...wizardForm, label: e.target.value })}
                  placeholder="Ex: Minerval - Décembre 2026"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Montant Unitaire ({currency}) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={wizardForm.amount}
                    onChange={e => setWizardForm({ ...wizardForm, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Date Limite de Règlement *
                  </label>
                  <input
                    type="date"
                    required
                    value={wizardForm.dueDate}
                    onChange={e => setWizardForm({ ...wizardForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-xs text-indigo-900">
                <span className="font-semibold block mb-0.5">Note de facturation automatique :</span>
                Cette opération crée une obligation individuelle dans le dossier de chaque élève inscrit dans cette
                classe pour l'année scolaire <strong>{school.schoolYear}</strong>.
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsWizardOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={generating}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  {generating ? 'Génération en cours...' : 'Lancer la Facturation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
