import React, { useState } from 'react';
import { ShieldCheck, Search, Filter, Clock, Download, AlertTriangle } from 'lucide-react';
import { AuditLog, School } from '../types';
import { formatDateTime, exportToCSV } from '../utils/formatters';

interface AuditPageProps {
  school: School;
  auditLogs: AuditLog[];
}

export const AuditPage: React.FC<AuditPageProps> = ({ school, auditLogs }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntity, setSelectedEntity] = useState('all');

  const filteredLogs = auditLogs.filter(log => {
    const entityName = log.entity || log.entityType || '';
    const matchesSearch =
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entityId.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesEntity = selectedEntity === 'all' || entityName.toLowerCase() === selectedEntity.toLowerCase();

    return matchesSearch && matchesEntity;
  });

  const handleExportCSV = () => {
    const rows = filteredLogs.map(l => ({
      Date_Heure: l.timestamp || l.createdAt || '',
      Utilisateur: l.userEmail,
      Action: l.action,
      Entite: l.entity || l.entityType || '-',
      ID_Entite: l.entityId,
      Donnees_Apres: l.after ? JSON.stringify(l.after) : '-',
    }));
    exportToCSV(`journal_audit_${school.schoolYear}`, rows);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Journal d'Audit Immuable
            </h2>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Conforme WORM / Fortresse
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Historique inaltérable de toutes les opérations financières, administratives et sécuritaires
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold px-3.5 py-2.5 rounded-xl transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4" />
          Exporter Journal d'Audit
        </button>
      </div>

      {/* Filter and Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Rechercher par action, email, id entité..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600"
          />
        </div>

        <select
          value={selectedEntity}
          onChange={e => setSelectedEntity(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 outline-none"
        >
          <option value="all">Toutes les entités</option>
          <option value="payment">Paiements (payment)</option>
          <option value="student">Élèves (student)</option>
          <option value="charge">Facturations (charge)</option>
          <option value="fee">Catalogue Frais (fee)</option>
          <option value="cash_closing">Clôtures de Caisse (cash_closing)</option>
          <option value="school">Paramètres Établissement (school)</option>
        </select>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Horodatage</th>
                <th className="py-3 px-4">Opérateur</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entité & ID</th>
                <th className="py-3 px-4">Détails de l'Opération</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    Aucun enregistrement d'audit trouvé.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                      {formatDateTime(log.timestamp || log.createdAt || '')}
                    </td>

                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      {log.userEmail}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded text-[11px]">
                        {log.action}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-800 block capitalize">{log.entity || log.entityType || '-'}</span>
                      <span className="font-mono text-[10px] text-slate-400 truncate max-w-[140px] block">
                        {log.entityId}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px] max-w-md truncate">
                      {log.after ? JSON.stringify(log.after) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
