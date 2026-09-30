import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Briefcase,
  Layers,
  UserCheck,
  Search,
  Edit2,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Mail,
  User,
  ShieldAlert,
} from 'lucide-react';
import { School, UserProfile, UserRole } from '../types';
import { SchoolService } from '../services/schoolService';
import { useAuth } from '../context/AuthContext';
import { getRoleLabel, formatDate } from '../utils/formatters';

interface UsersPageProps {
  school: School;
  users: UserProfile[];
  onRefreshData: () => Promise<void>;
}

export const UsersPage: React.FC<UsersPageProps> = ({
  school,
  users,
  onRefreshData,
}) => {
  const { schoolId, currentUser, profile, role } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form state for Add/Edit
  const [formData, setFormData] = useState<{
    id?: string;
    displayName: string;
    email: string;
    role: UserRole;
    active: boolean;
  }>({
    displayName: '',
    email: '',
    role: 'secretary',
    active: true,
  });

  const rolesConfig: {
    role: UserRole;
    label: string;
    icon: React.ReactNode;
    color: string;
    desc: string;
  }[] = [
    {
      role: 'admin',
      label: 'Administrateur Général',
      icon: <Shield className="w-4 h-4 text-indigo-600" />,
      color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      desc: 'Accès illimité : gestion des utilisateurs, paramètres, audit et finances.',
    },
    {
      role: 'director',
      label: 'Directeur des Études',
      icon: <Briefcase className="w-4 h-4 text-amber-600" />,
      color: 'bg-amber-50 text-amber-700 border-amber-200',
      desc: 'Supervision globale : inscriptions, dossiers élèves, billetterie et rapports.',
    },
    {
      role: 'cashier',
      label: 'Caissier Principal',
      icon: <Layers className="w-4 h-4 text-emerald-600" />,
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      desc: 'Opérations de caisse : encaissements, impression des reçus et clôtures.',
    },
    {
      role: 'secretary',
      label: 'Secrétaire Administratif',
      icon: <UserCheck className="w-4 h-4 text-blue-600" />,
      color: 'bg-blue-50 text-blue-700 border-blue-200',
      desc: 'Gestion administrative : inscription d\'élèves et consultation des dossiers.',
    },
  ];

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && u.active) ||
      (statusFilter === 'inactive' && !u.active);
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleOpenAddModal = () => {
    setFormData({
      displayName: '',
      email: '',
      role: 'secretary',
      active: true,
    });
    setEditingUser(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (u: UserProfile) => {
    setFormData({
      id: u.id,
      displayName: u.displayName,
      email: u.email,
      role: u.role,
      active: u.active,
    });
    setEditingUser(u);
    setIsAddModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.displayName) return;

    setSaving(true);
    setActionSuccess(null);
    setActionError(null);

    try {
      await SchoolService.saveUser(
        schoolId,
        {
          id: formData.id,
          displayName: formData.displayName.trim(),
          email: formData.email.trim().toLowerCase(),
          role: formData.role,
          active: formData.active,
        },
        currentUser?.uid || 'admin',
        currentUser?.email || profile?.email || 'admin@ecole.cd'
      );

      await onRefreshData();
      setIsAddModalOpen(false);
      setActionSuccess(
        formData.id
          ? `L'utilisateur "${formData.displayName}" a été modifié avec succès.`
          : `Le nouvel utilisateur "${formData.displayName}" a été ajouté avec succès.`
      );
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement de l\'utilisateur.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleQuickRoleChange = async (targetUser: UserProfile, newRole: UserRole) => {
    if (targetUser.role === newRole) return;

    try {
      await SchoolService.updateUserRole(
        schoolId,
        targetUser.id,
        newRole,
        currentUser?.uid || 'admin',
        currentUser?.email || profile?.email || 'admin@ecole.cd'
      );
      await onRefreshData();
      setActionSuccess(
        `Le rôle de "${targetUser.displayName}" a été mis à jour vers "${getRoleLabel(newRole)}".`
      );
    } catch (err: unknown) {
      alert(
        err instanceof Error ? err.message : 'Erreur lors du changement de rôle'
      );
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    // Protection: Prevent self-deletion
    if (
      userToDelete.id === currentUser?.uid ||
      userToDelete.email === currentUser?.email
    ) {
      alert('Action impossible : vous ne pouvez pas supprimer votre propre compte administrateur actif.');
      setUserToDelete(null);
      return;
    }

    setDeleting(true);
    setActionSuccess(null);
    setActionError(null);

    try {
      await SchoolService.deleteUser(
        schoolId,
        userToDelete.id,
        currentUser?.uid || 'admin',
        currentUser?.email || profile?.email || 'admin@ecole.cd'
      );
      await onRefreshData();
      setActionSuccess(
        `L'utilisateur "${userToDelete.displayName}" a été supprimé définitivement.`
      );
      setUserToDelete(null);
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : 'Erreur lors de la suppression de l\'utilisateur.'
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Gestion des Utilisateurs & Rôles
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              {users.length} compte{users.length > 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Administration des comptes d'accès, attribution des rôles RBAC et sécurisation logicielle pour {school.name}
          </p>
        </div>

        {role === 'admin' && (
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Ajouter un Utilisateur
          </button>
        )}
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-600 hover:text-emerald-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-rose-600 hover:text-rose-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Role Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {rolesConfig.map((item) => {
          const count = users.filter((u) => u.role === item.role).length;
          return (
            <div
              key={item.role}
              className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    {item.icon}
                  </div>
                  <span className="text-lg font-bold text-slate-900">{count}</span>
                </div>
                <h4 className="text-xs font-bold text-slate-800">{item.label}</h4>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  {item.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par nom ou email..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 outline-none"
          >
            <option value="all">Tous les rôles</option>
            <option value="admin">Administrateur Général</option>
            <option value="director">Directeur des Études</option>
            <option value="cashier">Caissier Principal</option>
            <option value="secretary">Secrétaire Administratif</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 outline-none"
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actif</option>
            <option value="inactive">Inactif / Suspendu</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Utilisateur</th>
                <th className="py-3 px-4">Email Officiel</th>
                <th className="py-3 px-4">Rôle Attribué</th>
                <th className="py-3 px-4 text-center">Statut</th>
                <th className="py-3 px-4">Date de Création</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Aucun utilisateur ne correspond aux critères de recherche.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrentLoggedUser =
                    u.id === currentUser?.uid || u.email === currentUser?.email;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                            {u.displayName?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-2">
                              {u.displayName || 'Utilisateur'}
                              {isCurrentLoggedUser && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  Votre compte
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">ID: {u.id}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-700">
                        {u.email}
                      </td>

                      <td className="py-3.5 px-4">
                        {role === 'admin' ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={u.role}
                              onChange={(e) =>
                                handleQuickRoleChange(u, e.target.value as UserRole)
                              }
                              className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-600"
                            >
                              <option value="admin">Administrateur Général</option>
                              <option value="director">Directeur des Études</option>
                              <option value="cashier">Caissier Principal</option>
                              <option value="secretary">Secrétaire Administratif</option>
                            </select>
                          </div>
                        ) : (
                          <span className="font-semibold text-slate-800">
                            {getRoleLabel(u.role)}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {u.active ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                            <CheckCircle className="w-3 h-3" />
                            Actif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                            Inactif
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-500">
                        {formatDate(u.createdAt)}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(u)}
                            title="Modifier les informations de l'utilisateur"
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setUserToDelete(u)}
                            disabled={isCurrentLoggedUser}
                            title={
                              isCurrentLoggedUser
                                ? 'Vous ne pouvez pas supprimer votre propre compte'
                                : 'Supprimer cet utilisateur'
                            }
                            className={`p-1.5 rounded-lg transition-colors ${
                              isCurrentLoggedUser
                                ? 'opacity-30 cursor-not-allowed text-slate-400'
                                : 'text-rose-600 hover:bg-rose-50 cursor-pointer'
                            }`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Modal: Add / Edit User */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">
                  {editingUser ? 'Modifier l\'Utilisateur' : 'Ajouter un Nouvel Utilisateur'}
                </h3>
                <p className="text-xs text-slate-400">
                  Définissez l'identité officielle et le rôle de permission RBAC
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Nom Complet / Titre *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={formData.displayName}
                    onChange={(e) =>
                      setFormData({ ...formData, displayName: e.target.value })
                    }
                    placeholder="Ex: Prof. Dieudonné Kalonji ou Mme Cécile Mbuyi"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Adresse Email Officielle *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="Ex: direction@college-boboto.cd"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Rôle & Niveau de Privilège *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value as UserRole })
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  <option value="admin">Administrateur Général (Accès total)</option>
                  <option value="director">Directeur des Études (Pédagogie & Direction)</option>
                  <option value="cashier">Caissier Principal (Caisse & Encaissements)</option>
                  <option value="secretary">Secrétaire Administratif (Inscriptions & Dossiers)</option>
                </select>
              </div>

              {/* Role explanation */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div className="font-semibold text-slate-800">
                  {getRoleLabel(formData.role)} :
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {rolesConfig.find((r) => r.role === formData.role)?.desc}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="activeUserCheckbox"
                  checked={formData.active}
                  onChange={(e) =>
                    setFormData({ ...formData, active: e.target.checked })
                  }
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                />
                <label
                  htmlFor="activeUserCheckbox"
                  className="text-xs font-medium text-slate-700 cursor-pointer"
                >
                  Compte actif et autorisé à utiliser le logiciel
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Enregistrement...' : editingUser ? 'Mettre à Jour' : 'Créer l\'Utilisateur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete User */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-full bg-rose-50 border border-rose-200">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Confirmer la Suppression
                </h3>
                <p className="text-xs text-slate-500">Cette action est irréversible</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Êtes-vous sûr de vouloir supprimer définitivement l'utilisateur{' '}
              <strong className="text-slate-900 font-semibold">{userToDelete.displayName}</strong>{' '}
              ({userToDelete.email}) avec le rôle{' '}
              <strong className="text-slate-900">{getRoleLabel(userToDelete.role)}</strong> ?
            </p>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800">
              Cette opération sera consignée dans le journal d'audit de sécurité de l'école.
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={deleting}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={deleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {deleting ? 'Suppression en cours...' : 'Supprimer Définitivement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
