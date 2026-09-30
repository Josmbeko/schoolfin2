import React, { useState } from 'react';
import {
  ArrowLeft,
  CreditCard,
  Printer,
  DollarSign,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Clock,
  ShieldCheck,
  Receipt as ReceiptIcon,
  Tag,
  AlertCircle,
  PlusCircle,
  Trash2,
  ArrowRightLeft,
  Sparkles,
  ShieldAlert,
  Sliders,
  RefreshCw,
  FileText,
  Edit3,
  UserCog,
} from 'lucide-react';
import { Student, StudentCharge, Payment, School, Receipt, ClassItem, OptionItem, SectionItem } from '../types';
import { formatCurrency, formatDate, formatDateTime, getChargeStatusMeta, getPaymentMethodLabel, getPaymentStatusMeta } from '../utils/formatters';
import { SchoolService } from '../services/schoolService';
import { useAuth } from '../context/AuthContext';
import { canSelectOption } from '../utils/academic';
import { StudentSituationModal } from '../components/common/StudentSituationModal';
import { StudentSituationStatementModal } from '../components/common/StudentSituationStatementModal';
import { EditStudentModal } from '../components/common/EditStudentModal';

interface StudentDetailPageProps {
  student: Student;
  school: School;
  classes?: ClassItem[];
  options?: OptionItem[];
  sections?: SectionItem[];
  charges: StudentCharge[];
  payments: Payment[];
  onBack: () => void;
  onOpenPaymentModal: (student: Student) => void;
  onViewReceipt: (receipt: Receipt) => void;
  onRefreshData: () => Promise<void>;
}

export const StudentDetailPage: React.FC<StudentDetailPageProps> = ({
  student,
  school,
  classes = [],
  options = [],
  sections = [],
  charges,
  payments,
  onBack,
  onOpenPaymentModal,
  onViewReceipt,
  onRefreshData,
}) => {
  const { schoolId, currentUser, profile, role } = useAuth();
  const currency = school.currency || 'CDF';

  // État local de l'élève pour mise à jour réactive immédiate
  const [activeStudent, setActiveStudent] = React.useState<Student>(student);
  React.useEffect(() => {
    setActiveStudent(student);
  }, [student]);

  // Modal d'édition des coordonnées du dossier (Secrétaire Administratif & Admin Général)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Situation modal state (Admin Général)
  const [isSituationModalOpen, setIsSituationModalOpen] = useState(false);
  const [isFicheModalOpen, setIsFicheModalOpen] = useState(false);
  const [syncingFees, setSyncingFees] = useState(false);

  // Discount modal state
  const [selectedChargeForDiscount, setSelectedChargeForDiscount] = useState<StudentCharge | null>(null);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState<string>('');
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Transfer modal state
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferClassId, setTransferClassId] = useState<string>('');
  const [transferOptionId, setTransferOptionId] = useState<string>('');
  const [transferReason, setTransferReason] = useState<string>('');
  const [transferring, setTransferring] = useState(false);

  const handleOpenTransferModal = () => {
    const otherClass = classes.find(c => c.id !== student.classId) || classes[0];
    const initialClassId = otherClass ? otherClass.id : student.classId;
    setTransferClassId(initialClassId);

    const targetCls = classes.find(c => c.id === initialClassId);
    if (targetCls && canSelectOption(targetCls.section, targetCls.level)) {
      setTransferOptionId(student.optionId || targetCls.optionId || options[0]?.id || '');
    } else {
      setTransferOptionId('');
    }
    setTransferReason('');
    setIsTransferModalOpen(true);
  };

  const handleTransferClassChange = (newClassId: string) => {
    setTransferClassId(newClassId);
    const targetCls = classes.find(c => c.id === newClassId);
    if (targetCls && canSelectOption(targetCls.section, targetCls.level)) {
      setTransferOptionId(student.optionId || targetCls.optionId || options[0]?.id || '');
    } else {
      setTransferOptionId('');
    }
  };

  const handleConfirmTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferClassId) return;

    setTransferring(true);
    try {
      const destCls = classes.find(c => c.id === transferClassId);
      const isEligible = destCls ? canSelectOption(destCls.section, destCls.level) : false;
      const effectiveOptionId = isEligible ? transferOptionId : '';

      await SchoolService.transferStudent(
        schoolId,
        student.id,
        transferClassId,
        effectiveOptionId,
        transferReason,
        currentUser?.uid || 'admin',
        currentUser?.email || profile?.email || 'admin@ecole.cd'
      );

      await onRefreshData();
      setIsTransferModalOpen(false);
      alert(`L'élève a été transféré avec succès vers la classe "${destCls?.name}".`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur lors du transfert');
    } finally {
      setTransferring(false);
    }
  };

  // Student specific data
  const studentCharges = charges.filter(c => c.studentId === student.id && c.status !== 'cancelled');
  const studentPayments = payments.filter(p => p.studentId === student.id);

  const totalBilled = studentCharges.reduce((sum, c) => sum + c.amountDue, 0);
  const totalDiscounts = studentCharges.reduce((sum, c) => sum + c.discountAmount, 0);
  const totalNet = studentCharges.reduce((sum, c) => sum + c.netAmount, 0);
  const totalPaid = studentPayments
    .filter(p => p.status === 'posted')
    .reduce((sum, p) => sum + p.amount, 0);
  const remainingDue = Math.max(0, totalNet - totalPaid);

  const handlePermanentDelete = async () => {
    setDeleting(true);
    try {
      await SchoolService.deleteStudentPermanently(
        schoolId,
        student.id,
        currentUser?.uid || 'admin',
        currentUser?.email || profile?.email || 'admin@ecole.cd'
      );
      await onRefreshData();
      onBack();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur lors de la suppression');
      setDeleting(false);
    }
  };

  const handleEnsureFees = async () => {
    setSyncingFees(true);
    try {
      await SchoolService.ensureAllStudentCharges(school.id, student.id);
      await onRefreshData();
      alert('Toutes les obligations de frais du catalogue sont synchronisées et éligibles.');
    } catch (e) {
      console.error(e);
      alert('Erreur lors de la synchronisation des frais.');
    } finally {
      setSyncingFees(false);
    }
  };

  const handleApplyDiscountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChargeForDiscount || discountAmount <= 0) return;

    setApplyingDiscount(true);
    try {
      await SchoolService.applyDiscount(
        schoolId,
        selectedChargeForDiscount.id,
        discountAmount,
        discountReason,
        currentUser?.uid || 'admin',
        currentUser?.email || profile?.email || 'admin@ecole.cd'
      );
      await onRefreshData();
      setSelectedChargeForDiscount(null);
      setDiscountAmount(0);
      setDiscountReason('');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur lors de la remise');
    } finally {
      setApplyingDiscount(false);
    }
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white rounded-lg border border-slate-200 text-slate-600 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-slate-900 uppercase">
                {activeStudent.lastName} {activeStudent.firstName}
              </h2>
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                {activeStudent.matricule}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Classe : <strong className="text-slate-800">{activeStudent.className}</strong>
              {activeStudent.section && ` · Section : ${activeStudent.section}`}
              {activeStudent.optionName && ` · Option : ${activeStudent.optionName}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Bouton Modifier le Dossier (Secrétaire Administratif & Administrateur Général) */}
          {['admin', 'secretary'].includes(role) && (
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="inline-flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold px-3 py-2.5 rounded-xl transition-colors cursor-pointer shadow-xs"
              title="Modifier les coordonnées de l'élève (Nom, Prénom, Genre, Date de naissance, Section, Classe, Option, Parent, Téléphone)"
            >
              <UserCog className="w-4 h-4 text-blue-600" />
              Modifier le Dossier
            </button>
          )}

          {['admin'].includes(role) && (
            <button
              onClick={() => setIsSituationModalOpen(true)}
              className="inline-flex items-center gap-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-semibold px-3 py-2.5 rounded-xl transition-colors cursor-pointer shadow-xs"
            >
              <ShieldAlert className="w-4 h-4 text-purple-600" />
              Modifier Situation
            </button>
          )}

          <button
            onClick={handleEnsureFees}
            disabled={syncingFees}
            title="S'assure que cet élève dispose de l'ensemble des frais scolaires éligibles au paiement direct"
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold px-3 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingFees ? 'animate-spin' : ''}`} />
            {syncingFees ? 'Génération...' : 'Synchroniser Frais'}
          </button>

          <button
            onClick={() => setIsFicheModalOpen(true)}
            className="inline-flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold px-3 py-2.5 rounded-xl transition-colors cursor-pointer shadow-xs"
            title="Générer la Fiche de Situation Financière & Scolaire Officielle (Imprimable A4)"
          >
            <FileText className="w-4 h-4 text-indigo-600" />
            Fiche de Situation
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold px-3 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Imprimer
          </button>

          {['admin', 'director', 'secretary'].includes(role) && (
            <button
              onClick={handleOpenTransferModal}
              className="inline-flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold px-3 py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              <ArrowRightLeft className="w-4 h-4" />
              Transférer
            </button>
          )}

          {['admin', 'director', 'cashier'].includes(role) && (
            <button
              onClick={() => onOpenPaymentModal(student)}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              Encaisser un Paiement
            </button>
          )}

          {['admin', 'director'].includes(role) && (
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="inline-flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold px-3 py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              Supprimer
            </button>
          )}
        </div>
      </div>

      {/* Administrative Situation Banner (if active) */}
      {student.financialSituation && (
        <div className="p-4 bg-purple-50/90 border border-purple-200/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs animate-in fade-in">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl shrink-0 mt-0.5 shadow-xs">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-purple-950 uppercase tracking-tight text-sm">
                  Situation Administrative : {student.financialSituation.label}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-200/80 text-purple-900 uppercase">
                  {student.financialSituation.scope === 'year'
                    ? "Toute l'année scolaire"
                    : `Mois : ${student.financialSituation.month}`}
                </span>
              </div>
              <p className="text-purple-900 mt-1 text-xs">
                <strong>Motif de l'Administrateur Général :</strong> "{student.financialSituation.motif}"
              </p>
              <p className="text-[11px] text-purple-600 mt-0.5">
                Décision appliquée par <strong>{student.financialSituation.updatedByName || student.financialSituation.updatedBy}</strong> le {formatDate(student.financialSituation.updatedAt)}
              </p>
            </div>
          </div>

          {['admin'].includes(role) && (
            <button
              onClick={() => setIsSituationModalOpen(true)}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold text-xs transition-colors shrink-0 shadow-xs cursor-pointer self-start sm:self-center"
            >
              Ajuster la Situation
            </button>
          )}
        </div>
      )}

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 uppercase font-semibold">Total Brut</span>
          <div className="text-lg font-bold text-slate-900 mt-1">
            {formatCurrency(totalBilled, currency)}
          </div>
          <span className="text-[11px] text-slate-400">Catalogue complet</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 uppercase font-semibold">Remises Accordées</span>
          <div className="text-lg font-bold text-amber-600 mt-1">
            {formatCurrency(totalDiscounts, currency)}
          </div>
          <span className="text-[11px] text-slate-400">Bourses & allègements</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 uppercase font-semibold">Net Exigible</span>
          <div className="text-lg font-bold text-indigo-900 mt-1">
            {formatCurrency(totalNet, currency)}
          </div>
          <span className="text-[11px] text-slate-400">Obligation finale</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 uppercase font-semibold">Total Déjà Payé</span>
          <div className="text-lg font-bold text-emerald-600 mt-1">
            {formatCurrency(totalPaid, currency)}
          </div>
          <span className="text-[11px] text-slate-400">Versements vérifiés</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 uppercase font-semibold">Solde Restant Dû</span>
          <div
            className={`text-lg font-bold mt-1 ${
              remainingDue > 0 ? 'text-rose-600' : 'text-emerald-600'
            }`}
          >
            {formatCurrency(remainingDue, currency)}
          </div>
          {student.creditAdvance > 0 ? (
            <span className="text-[11px] text-emerald-600 font-medium">
              Crédit d'avance : +{formatCurrency(student.creditAdvance, currency)}
            </span>
          ) : (
            <span className="text-[11px] text-slate-400">À recouvrer</span>
          )}
        </div>
      </div>

      {/* Info Sections: Personal & Family info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Informations Administratives
            </h3>
            {['admin', 'secretary'].includes(role) && (
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-200 transition-colors cursor-pointer"
                title="Modifier les coordonnées"
              >
                <Edit3 className="w-3 h-3" />
                Modifier
              </button>
            )}
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Matricule :</span>
              <strong className="font-mono text-slate-800">{activeStudent.matricule}</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Section académique :</span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {activeStudent.section || classes.find(c => c.id === activeStudent.classId)?.section || 'Générale'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Genre :</span>
              <span className="text-slate-800">{activeStudent.gender === 'M' ? 'Masculin' : 'Féminin'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Date de naissance :</span>
              <span className="text-slate-800">{formatDate(activeStudent.dateOfBirth)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Lieu de naissance :</span>
              <span className="text-slate-800">{activeStudent.placeOfBirth || '-'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Date d'inscription :</span>
              <span className="text-slate-800">{formatDate(activeStudent.enrollmentDate)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Statut dossier :</span>
              <span className="font-semibold text-emerald-700 capitalize">{activeStudent.status}</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
            Parent / Tuteur & Contact
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Responsable légal :</span>
              <strong className="text-slate-800">{activeStudent.parentName || '-'}</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Téléphone mobile :</span>
              <a href={`tel:${activeStudent.parentPhone}`} className="font-mono text-indigo-600 hover:underline">
                {activeStudent.parentPhone || '-'}
              </a>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Adresse email :</span>
              <span className="text-slate-800">{activeStudent.parentEmail || '-'}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Résidence :</span>
              <span className="text-slate-800 truncate max-w-[180px]">{activeStudent.address || '-'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
            Synthèse d'Assiduité Financière
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Taux de règlement des frais</span>
              <strong className="text-slate-800">
                {totalNet > 0 ? Math.round((totalPaid / totalNet) * 100) : 0}%
              </strong>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full"
                style={{ width: `${totalNet > 0 ? Math.min(100, Math.round((totalPaid / totalNet) * 100)) : 0}%` }}
              ></div>
            </div>

            <div className="pt-2 text-[11px] text-slate-500">
              {remainingDue === 0 ? (
                <div className="text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                  Cet élève est intégralement en ordre avec ses frais scolaires.
                </div>
              ) : (
                <div className="text-rose-700 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  Solde débiteur de {formatCurrency(remainingDue, currency)}. Relance conseillée.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Charges & Invoices Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 px-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Échéancier des Frais Facturés</h3>
            <p className="text-xs text-slate-500">Toutes les obligations scolaires générées pour cet élève</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Libellé Frais</th>
                <th className="py-3 px-4">Échéance</th>
                <th className="py-3 px-4 text-right">Montant Initial</th>
                <th className="py-3 px-4 text-right">Remise</th>
                <th className="py-3 px-4 text-right">Net Dû</th>
                <th className="py-3 px-4 text-right">Payé</th>
                <th className="py-3 px-4 text-right">Reste</th>
                <th className="py-3 px-4 text-center">Statut</th>
                {['admin', 'director'].includes(role) && (
                  <th className="py-3 px-4 text-center">Remise</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {studentCharges.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Aucun frais facturé pour le moment.
                  </td>
                </tr>
              ) : (
                studentCharges.map(c => {
                  const statusMeta = getChargeStatusMeta(c.status);
                  const remaining = Math.max(0, c.netAmount - c.paidAmount);

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-semibold text-slate-900">{c.label}</td>
                      <td className="py-3 px-4 text-slate-600">{formatDate(c.dueDate)}</td>
                      <td className="py-3 px-4 text-right text-slate-500">
                        {formatCurrency(c.amountDue, currency)}
                      </td>
                      <td className="py-3 px-4 text-right text-amber-600">
                        {c.discountAmount > 0 ? `-${formatCurrency(c.discountAmount, currency)}` : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900">
                        {formatCurrency(c.netAmount, currency)}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-600 font-medium">
                        {formatCurrency(c.paidAmount, currency)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-rose-600">
                        {formatCurrency(remaining, currency)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${statusMeta.bg} ${statusMeta.text}`}
                        >
                          {statusMeta.label}
                        </span>
                      </td>
                      {['admin', 'director'].includes(role) && (
                        <td className="py-3 px-4 text-center">
                          {c.status !== 'paid' && (
                            <button
                              onClick={() => {
                                setSelectedChargeForDiscount(c);
                                setDiscountAmount(c.discountAmount || 0);
                              }}
                              title="Appliquer une remise exceptionnelle"
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
                            >
                              Remise
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Transactions & Receipts Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 px-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Historique des Versements & Reçus</h3>
            <p className="text-xs text-slate-500">Paiements validés, annulés et reçus officiels émis</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">N° Reçu</th>
                <th className="py-3 px-4">Date Versement</th>
                <th className="py-3 px-4">Mode de Paiement</th>
                <th className="py-3 px-4">Caissier</th>
                <th className="py-3 px-4 text-right">Montant</th>
                <th className="py-3 px-4 text-center">Statut</th>
                <th className="py-3 px-4 text-center">Reçu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {studentPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Aucun versement n'a encore été enregistré pour cet élève.
                  </td>
                </tr>
              ) : (
                studentPayments.map(p => {
                  const statusMeta = getPaymentStatusMeta(p.status);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                        {p.receiptNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{formatDate(p.paymentDate)}</td>
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {getPaymentMethodLabel(p.paymentMethod)}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{p.createdByName}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatCurrency(p.amount, currency)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${statusMeta.bg} ${statusMeta.text}`}
                        >
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => {
                            const r: Receipt = {
                              id: `rec_${p.id}`,
                              schoolId: school.id,
                              receiptNumber: p.receiptNumber,
                              paymentId: p.id,
                              studentId: student.id,
                              studentName: `${student.lastName} ${student.firstName}`,
                              matricule: student.matricule,
                              className: student.className || '',
                              amount: p.amount,
                              amountInWords: '',
                              currency,
                              paymentMethod: getPaymentMethodLabel(p.paymentMethod),
                              cashierName: p.createdByName,
                              issuedAt: p.createdAt,
                            };
                            onViewReceipt(r);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded font-medium transition-colors cursor-pointer"
                        >
                          <ReceiptIcon className="w-3.5 h-3.5" />
                          Consulter
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

      {/* Modal: Apply Discount */}
      {selectedChargeForDiscount && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Accorder une Remise</h3>
                <p className="text-xs text-slate-400">{selectedChargeForDiscount.label}</p>
              </div>
              <button
                onClick={() => setSelectedChargeForDiscount(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleApplyDiscountSubmit} className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Montant initial :</span>
                  <strong>{formatCurrency(selectedChargeForDiscount.amountDue, currency)}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Plafond max remise :</span>
                  <strong className="text-rose-600">
                    {formatCurrency(selectedChargeForDiscount.amountDue, currency)}
                  </strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Montant de la Remise ({currency}) *
                </label>
                <input
                  type="number"
                  min="0"
                  max={selectedChargeForDiscount.amountDue}
                  step="any"
                  required
                  value={discountAmount || ''}
                  onChange={e => setDiscountAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Motif de la Remise (Bourse, réduction fratrie, cas social) *
                </label>
                <input
                  type="text"
                  required
                  value={discountReason}
                  onChange={e => setDiscountReason(e.target.value)}
                  placeholder="Ex: Bourse d'excellence académique"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedChargeForDiscount(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={applyingDiscount || discountAmount <= 0}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  {applyingDiscount ? 'Validation...' : 'Valider la Remise'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Permanent Delete Student */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-rose-600 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Supprimer Définitivement le Dossier Élève
              </h3>
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-700 leading-relaxed">
                Êtes-vous absolument sûr de vouloir supprimer définitivement l'élève{' '}
                <strong className="text-slate-900 uppercase">
                  {student.lastName} {student.firstName}
                </strong>{' '}
                (Matricule : <strong className="font-mono">{student.matricule}</strong>) ?
              </p>

              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 space-y-1">
                <p className="font-bold">⚠️ Suppression irréversible :</p>
                <p>
                  Cette opération efface définitivement le dossier scolaire, le profil de l'élève de sa classe ({student.className}) ainsi que l'ensemble de ses charges et données associées.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handlePermanentDelete}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  {deleting ? 'Suppression en cours...' : 'Supprimer Définitivement'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Transfer Student between Classes & Options */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-indigo-400" />
                  Transfert de Classe & d'Option
                </h3>
                <p className="text-xs text-slate-400">
                  Déplacez l'élève vers une nouvelle classe avec réattribution d'option
                </p>
              </div>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmTransfer} className="p-6 space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Élève
                  </div>
                  <div className="text-xs font-bold text-slate-900 uppercase">
                    {student.lastName} {student.firstName}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                    Matricule : {student.matricule}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">
                    Classe actuelle
                  </div>
                  <div className="text-xs font-bold text-indigo-700">
                    {student.className || 'Non assignée'}
                  </div>
                  {student.optionName && (
                    <div className="text-[11px] text-slate-600 truncate max-w-[170px]">
                      {student.optionName}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                  Nouvelle Classe de Destination *
                </label>
                <select
                  required
                  value={transferClassId}
                  onChange={(e) => handleTransferClassChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  <option value="" disabled>-- Sélectionner la nouvelle classe --</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} ({cls.section} · {cls.level})
                    </option>
                  ))}
                </select>
              </div>

              {/* Destination Option Selection */}
              {(() => {
                const destCls = classes.find((c) => c.id === transferClassId);
                const isEligible = destCls ? canSelectOption(destCls.section, destCls.level) : false;

                if (isEligible) {
                  return (
                    <div className="space-y-1.5 p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-xl">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-indigo-900 uppercase">
                          Choix de l'Option / Filière (Secondaire)
                        </label>
                        <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                          1ère à 4è Secondaire
                        </span>
                      </div>
                      <p className="text-[11px] text-indigo-700">
                        Cette classe autorise une spécialité académique. Vous pouvez changer l'option de l'élève ou laisser sans option.
                      </p>
                      <select
                        value={transferOptionId}
                        onChange={(e) => setTransferOptionId(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-600"
                      >
                        <option value="">-- Sans option spécifique --</option>
                        {options.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.name} ({opt.section})
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                } else if (destCls) {
                  return (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold">Section sans option :</div>
                        <div className="text-[11px] text-amber-700 mt-0.5">
                          Pour la classe <strong>{destCls.name}</strong> ({destCls.section} · {destCls.level}), les options ne sont pas applicables (réservées aux 1ère, 2è, 3è et 4è du Secondaire). L'option de l'élève sera réinitialisée.
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Motif ou Note Administrative (Facultatif)
                </label>
                <input
                  type="text"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="Ex: Réorientation de filière, passage de classe, décision rectorat..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={transferring || !transferClassId}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  {transferring ? 'Transfert en cours...' : 'Valider le Transfert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal: Modifier la Situation (Administrateur Général) */}
      {isSituationModalOpen && (
        <StudentSituationModal
          student={student}
          school={school}
          onClose={() => setIsSituationModalOpen(false)}
          onSuccess={async () => {
            await onRefreshData();
            setIsSituationModalOpen(false);
          }}
        />
      )}

      {/* Modal: Fiche de Situation Financière & Scolaire Officielle (Imprimable A4) */}
      {isFicheModalOpen && (
        <StudentSituationStatementModal
          student={activeStudent}
          school={school}
          charges={charges}
          payments={payments}
          onClose={() => setIsFicheModalOpen(false)}
        />
      )}

      {/* Modal: Modifier les Coordonnées du Dossier (Secrétaire Administratif & Admin Général) */}
      {isEditModalOpen && (
        <EditStudentModal
          student={activeStudent}
          school={school}
          classes={classes}
          options={options}
          sections={sections}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={async (updatedStudent) => {
            setActiveStudent(updatedStudent);
            await onRefreshData();
            setIsEditModalOpen(false);
          }}
        />
      )}
    </div>
  );
};
