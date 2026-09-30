import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  Trash2,
  GraduationCap,
  Users,
  AlertTriangle,
  Info,
  CheckCircle,
  Layers,
} from 'lucide-react';
import { School, SectionItem, ClassItem, Student } from '../types';
import { SchoolService } from '../services/schoolService';
import { useAuth } from '../context/AuthContext';

interface SectionsPageProps {
  school: School;
  sections: SectionItem[];
  classes: ClassItem[];
  students: Student[];
  onRefreshData: () => Promise<void>;
}

export const SectionsPage: React.FC<SectionsPageProps> = ({
  school,
  sections,
  classes,
  students,
  onRefreshData,
}) => {
  const { schoolId, currentUser, profile, role } = useAuth();
  const isAdmin = ['admin', 'director'].includes(role);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [sectionToDelete, setSectionToDelete] = useState<SectionItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // New section form
  const [formData, setFormData] = useState<{
    name: string;
    code: string;
    description: string;
    order: number;
  }>({
    name: '',
    code: '',
    description: '',
    order: sections.length + 1,
  });

  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    setSaving(true);
    try {
      await SchoolService.saveSection(
        schoolId,
        {
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase() || formData.name.substring(0, 4).toUpperCase(),
          description: formData.description.trim(),
          order: Number(formData.order) || sections.length + 1,
          active: true,
        },
        currentUser?.uid || 'admin',
        currentUser?.email || profile?.email || 'admin@ecole.cd'
      );

      await onRefreshData();
      setIsAddModalOpen(false);
      setFormData({
        name: '',
        code: '',
        description: '',
        order: sections.length + 2,
      });
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la création de la section');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!sectionToDelete) return;

    setDeleting(true);
    try {
      await SchoolService.deleteSection(
        schoolId,
        sectionToDelete.id,
        currentUser?.uid || 'admin',
        currentUser?.email || profile?.email || 'admin@ecole.cd'
      );
      await onRefreshData();
      setSectionToDelete(null);
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la suppression de la section');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            Sections Pédagogiques
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Organisation des cycles d'enseignement de {school.name} (Maternelle, Primaire, Éducation de Base, Secondaire, etc.)
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Ajouter une Section
          </button>
        )}
      </div>

      {/* Info Notice about Options in Secondaire */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-xs text-indigo-900 flex items-start gap-3">
        <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Structure académique & Règle des filières :</span> Les sections regroupent les niveaux scolaires de l'établissement. Conformément aux programmes éducatifs, les filières et options (Scientifique, Commerciale & Gestion, Littéraire, etc.) s'appliquent spécifiquement aux classes de <strong>1ère, 2è, 3è et 4è Secondaire</strong>.
        </div>
      </div>

      {/* Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {sections.map(section => {
          // Classes in this section
          const sectionClasses = classes.filter(
            c => c.section.trim().toLowerCase() === section.name.trim().toLowerCase()
          );
          // Student count
          const classIds = new Set(sectionClasses.map(c => c.id));
          const studentCount = students.filter(s => classIds.has(s.classId)).length;
          const isSecondaire =
            section.name.toLowerCase().includes('secondaire') ||
            section.name.toLowerCase().includes('humanit');

          return (
            <div
              key={section.id}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {section.code || 'SEC'}
                      </span>
                      {isSecondaire && (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                          Options 1ère-4è
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mt-1.5">{section.name}</h3>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">Ordre #{section.order || 1}</span>
                </div>

                <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                  {section.description || 'Section pédagogique officielle de l\'établissement.'}
                </p>

                {/* Statistics */}
                <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[11px] text-slate-500 block">Classes</span>
                    <strong className="text-sm font-bold text-slate-900 flex items-center gap-1 mt-0.5">
                      <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                      {sectionClasses.length}
                    </strong>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[11px] text-slate-500 block">Élèves inscrits</span>
                    <strong className="text-sm font-bold text-slate-900 flex items-center gap-1 mt-0.5">
                      <Users className="w-3.5 h-3.5 text-emerald-600" />
                      {studentCount}
                    </strong>
                  </div>
                </div>

                {/* Classes previews */}
                {sectionClasses.length > 0 && (
                  <div className="mt-3">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                      Classes rattachées :
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {sectionClasses.slice(0, 4).map(c => (
                        <span
                          key={c.id}
                          className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium"
                        >
                          {c.name}
                        </span>
                      ))}
                      {sectionClasses.length > 4 && (
                        <span className="text-[11px] text-slate-400 self-center">
                          +{sectionClasses.length - 4} autres
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Admin Actions */}
              {isAdmin && (
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {sectionClasses.length > 0 ? `${sectionClasses.length} classes actives` : 'Aucune classe'}
                  </span>
                  <button
                    onClick={() => setSectionToDelete(section)}
                    title="Supprimer la section"
                    className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Supprimer
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal: Add Section */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-400" />
                Ajouter une Nouvelle Section
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSection} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Nom de la Section *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Secondaire, Primaire, Technique..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Code Court
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="Ex: SEC, PRIM"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs uppercase font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Ordre d'affichage
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.order}
                    onChange={e => setFormData({ ...formData, order: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ex: Humanités générales et options spécialisées..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  {saving ? 'Enregistrement...' : 'Créer la Section'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Delete Section */}
      {sectionToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-rose-600 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Suppression de Section
              </h3>
              <button
                onClick={() => setSectionToDelete(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-700 leading-relaxed">
                Êtes-vous sûr de vouloir supprimer définitivement la section{' '}
                <strong className="text-slate-900">"{sectionToDelete.name}"</strong> ?
              </p>

              {classes.some(
                c => c.section.trim().toLowerCase() === sectionToDelete.name.trim().toLowerCase()
              ) && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  ⚠️ <strong>Attention :</strong> Des classes sont actuellement rattachées à cette section. Assurez-vous de réassigner ces classes avant de supprimer.
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSectionToDelete(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleConfirmDelete}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  {deleting ? 'Suppression...' : 'Supprimer Définitivement'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
