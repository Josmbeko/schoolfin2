import React, { useState, useEffect } from 'react';
import {
  School as SchoolIcon,
  UserCheck,
  LogOut,
  Sparkles,
  Search,
  Check,
  Shield,
  Briefcase,
  Layers,
  ChevronDown,
  Menu,
  X,
  Calendar,
  Clock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { School, UserRole } from '../../types';
import { getRoleLabel } from '../../utils/formatters';

interface NavbarProps {
  school: School | null;
  onSeedData: () => Promise<void>;
  seeding: boolean;
  onSearchOpen?: () => void;
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  school,
  onSeedData,
  seeding,
  onToggleMobileMenu,
  isMobileMenuOpen,
}) => {
  const { currentUser, role, switchRole, signOut, signInWithGoogle } = useAuth();
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

  // Horloge & Date en temps réel
  const [currentDateTime, setCurrentDateTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const dateFormatted = currentDateTime.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timeFormatted = currentDateTime.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const rolesList: { role: UserRole; desc: string; icon: React.ReactNode }[] = [
    { role: 'admin', desc: 'Accès total, configurations & utilisateurs', icon: <Shield className="w-3.5 h-3.5 text-indigo-600" /> },
    { role: 'director', desc: 'Supervision pédagogique & financière', icon: <Briefcase className="w-3.5 h-3.5 text-amber-600" /> },
    { role: 'cashier', desc: 'Encaissements, reçus & journal de caisse', icon: <Layers className="w-3.5 h-3.5 text-emerald-600" /> },
    { role: 'secretary', desc: 'Inscriptions & gestion administrative', icon: <UserCheck className="w-3.5 h-3.5 text-blue-600" /> },
  ];

  // Localisation officielle renseignée dans les paramètres : « Ville – Province – Pays »
  const schoolLocation = [school?.city, school?.province, school?.country]
    .filter(val => val && val.trim().length > 0)
    .join(' – ') || 'Kinshasa – Kinshasa – République Démocratique du Congo';

  return (
    <header className="no-print bg-white border-b border-slate-200 sticky top-0 z-30 h-16">
      <div className="h-full px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Brand & School Name & Hamburger on mobile */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {onToggleMobileMenu && (
            <button
              onClick={onToggleMobileMenu}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              aria-label="Menu de navigation"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5 text-indigo-600" /> : <Menu className="w-5 h-5" />}
            </button>
          )}

          {school?.logoUrl ? (
            <img
              src={school.logoUrl}
              alt={school.name || 'Logo'}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-contain bg-white border border-slate-200 p-0.5 shadow-xs shrink-0"
            />
          ) : (
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-base sm:text-lg shadow-sm shrink-0">
              <SchoolIcon className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h1 className="font-bold text-slate-900 text-xs sm:text-base leading-tight truncate max-w-[120px] sm:max-w-xs md:max-w-md">
                {school?.name || 'EduFinance Pro'}
              </h1>
              <span className="text-[10px] sm:text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.5 rounded shrink-0">
                {school?.schoolYear || '2026-2027'}
              </span>

              {/* Date et Heure en direct à côté du nom du logiciel */}
              <div
                className="flex items-center gap-1.5 text-[10px] sm:text-xs text-slate-700 bg-slate-100/90 border border-slate-200/80 px-2 py-0.5 rounded-lg font-medium shadow-2xs shrink-0"
                title="Date et heure du système en temps réel"
              >
                <Calendar className="w-3 h-3 text-indigo-600 hidden sm:inline" />
                <span className="capitalize text-slate-700">{dateFormatted}</span>
                <span className="text-slate-300">•</span>
                <Clock className="w-3 h-3 text-indigo-600" />
                <span className="font-mono font-bold text-indigo-900">{timeFormatted}</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 font-medium truncate max-w-[200px] sm:max-w-md hidden sm:block" title={schoolLocation}>
              {schoolLocation}
            </p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Seed Demo Data Button */}
          <button
            onClick={onSeedData}
            disabled={seeding}
            title="Injecte des classes, élèves, factures et paiements de test"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            {seeding ? 'Chargement démo...' : 'Données Démo'}
          </button>

          {/* Role Switcher Selector */}
          <div className="relative">
            <button
              onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
              className="flex items-center gap-1.5 sm:gap-2 bg-slate-50 border border-slate-200 hover:border-slate-300 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-slate-800 transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
              <span className="truncate max-w-[90px] sm:max-w-none">{getRoleLabel(role)}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {roleDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Changer de Rôle Utilisateur
                </div>
                {rolesList.map(item => (
                  <button
                    key={item.role}
                    onClick={() => {
                      switchRole(item.role);
                      setRoleDropdownOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs flex items-start justify-between hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5">{item.icon}</div>
                      <div>
                        <div className="font-semibold text-slate-900">{getRoleLabel(item.role)}</div>
                        <div className="text-[11px] text-slate-500">{item.desc}</div>
                      </div>
                    </div>
                    {role === item.role && <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Auth State & Logout */}
          {currentUser ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold">
                {currentUser.displayName?.charAt(0) || currentUser.email?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <button
                onClick={signOut}
                title="Déconnexion"
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              Connexion Google
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
