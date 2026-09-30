import React, { useState } from 'react';
import {
  BarChart3,
  Download,
  Printer,
  Calendar,
  Layers,
  Users,
  AlertOctagon,
  Percent,
  CheckCircle,
} from 'lucide-react';
import { School, Student, StudentCharge, Payment, ClassItem, FeeType } from '../types';
import { formatCurrency, formatDate, exportToCSV } from '../utils/formatters';

interface ReportsPageProps {
  school: School;
  students: Student[];
  charges: StudentCharge[];
  payments: Payment[];
  classes: ClassItem[];
  feeTypes: FeeType[];
}

export const ReportsPage: React.FC<ReportsPageProps> = ({
  school,
  students,
  charges,
  payments,
  classes,
  feeTypes,
}) => {
  const currency = school.currency || 'CDF';
  const [reportType, setReportType] = useState<
    'overdue' | 'class_summary' | 'fee_summary' | 'advances'
  >('overdue');

  // Overdue students list
  const overdueStudents = students
    .map(s => {
      const studentCharges = charges.filter(c => c.studentId === s.id && c.status !== 'cancelled');
      const studentPayments = payments.filter(p => p.studentId === s.id && p.status === 'posted');
      const billed = studentCharges.reduce((sum, c) => sum + c.netAmount, 0);
      const paid = studentPayments.reduce((sum, p) => sum + p.amount, 0);
      const debt = Math.max(0, billed - paid);
      return {
        student: s,
        billed,
        paid,
        debt,
      };
    })
    .filter(item => item.debt > 0)
    .sort((a, b) => b.debt - a.debt);

  // Class summary list
  const classReports = classes.map(c => {
    const classStudents = students.filter(s => s.classId === c.id);
    const classStudentIds = new Set(classStudents.map(s => s.id));
    const classCharges = charges.filter(
      ch => classStudentIds.has(ch.studentId) && ch.status !== 'cancelled'
    );
    const classPayments = payments.filter(
      p => classStudentIds.has(p.studentId) && p.status === 'posted'
    );

    const totalBilled = classCharges.reduce((sum, ch) => sum + ch.netAmount, 0);
    const totalCollected = classPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalRemaining = Math.max(0, totalBilled - totalCollected);
    const rate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

    return {
      classItem: c,
      studentCount: classStudents.length,
      totalBilled,
      totalCollected,
      totalRemaining,
      rate,
    };
  });

  // Fee type summary list
  const feeTypeReports = feeTypes.map(f => {
    const feeCharges = charges.filter(c => c.feeTypeId === f.id && c.status !== 'cancelled');
    const billed = feeCharges.reduce((sum, c) => sum + c.netAmount, 0);
    const paid = feeCharges.reduce((sum, c) => sum + c.paidAmount, 0);
    const remaining = Math.max(0, billed - paid);
    const rate = billed > 0 ? Math.round((paid / billed) * 100) : 0;

    return {
      feeType: f,
      chargesCount: feeCharges.length,
      billed,
      paid,
      remaining,
      rate,
    };
  });

  // Advances list
  const advanceStudents = students.filter(s => (s.creditAdvance || 0) > 0);

  const handleExportCurrent = () => {
    if (reportType === 'overdue') {
      const rows = overdueStudents.map(item => ({
        Matricule: item.student.matricule,
        Nom: item.student.lastName,
        Prénom: item.student.firstName,
        Classe: item.student.className,
        Tuteur: item.student.parentName,
        Téléphone: item.student.parentPhone,
        Total_Facturé: item.billed,
        Total_Payé: item.paid,
        Dette_Reste_Dû: item.debt,
      }));
      exportToCSV(`rapport_impayes_${school.schoolYear}`, rows);
    } else if (reportType === 'class_summary') {
      const rows = classReports.map(item => ({
        Classe: item.classItem.name,
        Section: item.classItem.section,
        Effectif: item.studentCount,
        Total_Facturé: item.totalBilled,
        Total_Recouvré: item.totalCollected,
        Reste_À_Recouvrer: item.totalRemaining,
        Taux_Recouvrement: `${item.rate}%`,
      }));
      exportToCSV(`recouvrement_par_classe_${school.schoolYear}`, rows);
    } else if (reportType === 'fee_summary') {
      const rows = feeTypeReports.map(item => ({
        Frais: item.feeType.name,
        Périodicité: item.feeType.frequency,
        Factures_Émises: item.chargesCount,
        Total_Facturé: item.billed,
        Total_Encaissé: item.paid,
        Reste_Dû: item.remaining,
        Taux_Recouvrement: `${item.rate}%`,
      }));
      exportToCSV(`rapport_par_type_frais_${school.schoolYear}`, rows);
    } else if (reportType === 'advances') {
      const rows = advanceStudents.map(s => ({
        Matricule: s.matricule,
        Élève: `${s.lastName} ${s.firstName}`,
        Classe: s.className,
        Tuteur: s.parentName,
        Téléphone: s.parentPhone,
        Avance_Crédit: s.creditAdvance,
      }));
      exportToCSV(`rapport_avances_eleves_${school.schoolYear}`, rows);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            États & Rapports Financiers
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Analyses de recouvrement, état de créances, balance par classe et extraction comptable
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold px-3.5 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Imprimer Rapport
          </button>

          <button
            onClick={handleExportCurrent}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Exporter CSV
          </button>
        </div>
      </div>

      {/* Report Switcher Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {[
          { id: 'overdue', label: `Créances & Impayés (${overdueStudents.length})`, icon: <AlertOctagon className="w-4 h-4" /> },
          { id: 'class_summary', label: 'Bilan par Classe', icon: <Users className="w-4 h-4" /> },
          { id: 'fee_summary', label: 'Bilan par Type de Frais', icon: <Layers className="w-4 h-4" /> },
          { id: 'advances', label: `Avances en Compte (${advanceStudents.length})`, icon: <Percent className="w-4 h-4" /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setReportType(tab.id as any)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              reportType === tab.id
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* OVERDUE REPORT */}
      {reportType === 'overdue' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 px-6 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Élèves Débiteurs & Soldes Impayés</h3>
              <p className="text-xs text-slate-500">
                Liste pour les relances téléphoniques et avis de paiement aux parents
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Total Créances Établissement</span>
              <strong className="text-base font-extrabold text-rose-600">
                {formatCurrency(
                  overdueStudents.reduce((acc, i) => acc + i.debt, 0),
                  currency
                )}
              </strong>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Matricule</th>
                  <th className="py-3 px-4">Élève</th>
                  <th className="py-3 px-4">Classe</th>
                  <th className="py-3 px-4">Parent / Contact Téléphone</th>
                  <th className="py-3 px-4 text-right">Total Dû</th>
                  <th className="py-3 px-4 text-right">Déjà Payé</th>
                  <th className="py-3 px-4 text-right">Dette Nette</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overdueStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Félicitations ! Aucun élève ne présente de solde débiteur.
                    </td>
                  </tr>
                ) : (
                  overdueStudents.map(item => (
                    <tr key={item.student.id} className="hover:bg-slate-50/70">
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-700">
                        {item.student.matricule}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 uppercase">
                        {item.student.lastName} {item.student.firstName}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">{item.student.className}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{item.student.parentName}</div>
                        <a
                          href={`tel:${item.student.parentPhone}`}
                          className="font-mono text-[11px] text-indigo-600 hover:underline"
                        >
                          {item.student.parentPhone}
                        </a>
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-600">
                        {formatCurrency(item.billed, currency)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-emerald-600">
                        {formatCurrency(item.paid, currency)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-rose-600">
                        {formatCurrency(item.debt, currency)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CLASS RECOVERY REPORT */}
      {reportType === 'class_summary' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 px-6 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">Bilan de Recouvrement par Classe</h3>
            <p className="text-xs text-slate-500">Comparatif des taux de recouvrement pédagogiques</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Classe</th>
                  <th className="py-3 px-4">Section</th>
                  <th className="py-3 px-4 text-center">Effectif</th>
                  <th className="py-3 px-4 text-right">Facturé</th>
                  <th className="py-3 px-4 text-right">Encaissé</th>
                  <th className="py-3 px-4 text-right">Reste Dû</th>
                  <th className="py-3 px-4 text-center">Taux (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classReports.map(item => (
                  <tr key={item.classItem.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{item.classItem.name}</td>
                    <td className="py-3.5 px-4 text-slate-600">{item.classItem.section}</td>
                    <td className="py-3.5 px-4 text-center font-semibold text-slate-800">
                      {item.studentCount}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-600">
                      {formatCurrency(item.totalBilled, currency)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-emerald-600">
                      {formatCurrency(item.totalCollected, currency)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-rose-600">
                      {formatCurrency(item.totalRemaining, currency)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                          item.rate >= 75
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.rate >= 50
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {item.rate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FEE SUMMARY REPORT */}
      {reportType === 'fee_summary' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 px-6 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">Bilan de Recouvrement par Type de Frais</h3>
            <p className="text-xs text-slate-500">Rentabilité par poste de dépense scolaire</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Libellé Frais</th>
                  <th className="py-3 px-4">Périodicité</th>
                  <th className="py-3 px-4 text-center">Lignes Émises</th>
                  <th className="py-3 px-4 text-right">Facturé</th>
                  <th className="py-3 px-4 text-right">Encaissé</th>
                  <th className="py-3 px-4 text-right">Reste</th>
                  <th className="py-3 px-4 text-center">Taux</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {feeTypeReports.map(item => (
                  <tr key={item.feeType.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{item.feeType.name}</td>
                    <td className="py-3.5 px-4 text-slate-600 capitalize">{item.feeType.frequency}</td>
                    <td className="py-3.5 px-4 text-center text-slate-700">{item.chargesCount}</td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-600">
                      {formatCurrency(item.billed, currency)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-emerald-600">
                      {formatCurrency(item.paid, currency)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-rose-600">
                      {formatCurrency(item.remaining, currency)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                        {item.rate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADVANCES REPORT */}
      {reportType === 'advances' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 px-6 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Avances & Soldes Créditeurs Élèves</h3>
              <p className="text-xs text-slate-500">Fonds déposés d'avance par les familles</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Total Avances Déposées</span>
              <strong className="text-base font-extrabold text-emerald-600">
                {formatCurrency(
                  advanceStudents.reduce((acc, s) => acc + (s.creditAdvance || 0), 0),
                  currency
                )}
              </strong>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Matricule</th>
                  <th className="py-3 px-4">Élève</th>
                  <th className="py-3 px-4">Classe</th>
                  <th className="py-3 px-4">Parent / Contact</th>
                  <th className="py-3 px-4 text-right">Avance Disponible</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {advanceStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      Aucun élève ne dispose actuellement d'avance en compte.
                    </td>
                  </tr>
                ) : (
                  advanceStudents.map(student => (
                    <tr key={student.id} className="hover:bg-slate-50/70">
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-700">
                        {student.matricule}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 uppercase">
                        {student.lastName} {student.firstName}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">{student.className}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{student.parentName}</div>
                        <div className="font-mono text-[11px] text-slate-500">{student.parentPhone}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-emerald-600">
                        +{formatCurrency(student.creditAdvance, currency)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
