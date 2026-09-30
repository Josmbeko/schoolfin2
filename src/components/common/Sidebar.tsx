import React from 'react';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Layers,
  FileText,
  CreditCard,
  Receipt as ReceiptIcon,
  BarChart3,
  ShieldAlert,
  Settings,
  ShieldCheck,
  BookOpen,
  Sparkles,
  UserCheck,
  School as SchoolIcon,
  X,
} from 'lucide-react';
import { UserRole } from '../../types';

export type ActiveTab =
  | 'dashboard'
  | 'students'
  | 'classes'
  | 'sections'
  | 'options'
  | 'fees'
  | 'billing'
  | 'payments'
  | 'cash'
  | 'reports'
  | 'audit'
  | 'users'
  | 'settings'
  | 'tests';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  role: UserRole;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  role,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const navItems: {
    id: ActiveTab;
    label: string;
    icon: React.ReactNode;
    minRole: UserRole[];
    badge?: string;
  }[] = [
    {
      id: 'dashboard',
      label: 'Tableau de Bord',
      icon: <LayoutDashboard className="w-4 h-4" />,
      minRole: ['admin', 'director', 'cashier', 'secretary'],
    },
    {
      id: 'students',
      label: 'Élèves & Dossiers',
      icon: <Users className="w-4 h-4" />,
      minRole: ['admin', 'director', 'cashier', 'secretary'],
    },
    {
      id: 'classes',
      label: 'Classes',
      icon: <GraduationCap className="w-4 h-4" />,
      minRole: ['admin', 'director', 'secretary'],
    },
    {
      id: 'sections',
      label: 'Sections',
      icon: <BookOpen className="w-4 h-4" />,
      minRole: ['admin', 'director'],
    },
    {
      id: 'options',
      label: 'Options / Filières',
      icon: <Sparkles className="w-4 h-4" />,
      minRole: ['admin', 'director', 'secretary'],
    },
    {
      id: 'fees',
      label: 'Catalogue des Frais',
      icon: <Layers className="w-4 h-4" />,
      minRole: ['admin', 'director'],
    },
    {
      id: 'billing',
      label: 'Facturation & Échéancier',
      icon: <FileText className="w-4 h-4" />,
      minRole: ['admin', 'director'],
    },
    {
      id: 'payments',
      label: 'Paiements & Reçus',
      icon: <CreditCard className="w-4 h-4" />,
      minRole: ['admin', 'director', 'cashier'],
      badge: 'Caisse',
    },
    {
      id: 'cash',
      label: 'Journal de Caisse',
      icon: <ReceiptIcon className="w-4 h-4" />,
      minRole: ['admin', 'director', 'cashier'],
    },
    {
      id: 'reports',
      label: 'Rapports Financiers',
      icon: <BarChart3 className="w-4 h-4" />,
      minRole: ['admin', 'director'],
    },
    {
      id: 'audit',
      label: "Journal d'Audit",
      icon: <ShieldAlert className="w-4 h-4" />,
      minRole: ['admin'],
      badge: 'Sécurité',
    },
    {
      id: 'users',
      label: 'Gestion Utilisateurs',
      icon: <UserCheck className="w-4 h-4" />,
      minRole: ['admin'],
      badge: 'RBAC',
    },
    {
      id: 'settings',
      label: 'Paramètres École',
      icon: <Settings className="w-4 h-4" />,
      minRole: ['admin'],
    },
    {
      id: 'tests',
      label: 'Tests Financiers TDD',
      icon: <ShieldCheck className="w-4 h-4 text-emerald-500" />,
      minRole: ['admin', 'director', 'cashier', 'secretary'],
      badge: 'Vérification',
    },
  ];

  const renderNavList = () => (
    <div className="p-3 sm:p-4 flex-1 space-y-1 overflow-y-auto">
      <div className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
        Menu Principal
      </div>

      {navItems.map(item => {
        const isAllowed = item.minRole.includes(role);
        const isActive = activeTab === item.id;

        return (
          <button
            key={item.id}
            disabled={!isAllowed}
            onClick={() => {
              setActiveTab(item.id);
              if (onCloseMobile) onCloseMobile();
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors text-left ${
              !isAllowed
                ? 'opacity-40 cursor-not-allowed text-slate-400'
                : isActive
                ? 'bg-indigo-50 text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 cursor-pointer'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className={isActive ? 'text-indigo-600' : 'text-slate-400'}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </div>

            {item.badge && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (hidden on screens < 1024px) */}
      <aside className="no-print hidden lg:flex w-64 bg-white border-r border-slate-200 flex-col shrink-0 min-h-[calc(100vh-4rem)]">
        {renderNavList()}

        {/* Footer info */}
        <div className="p-4 border-t border-slate-200 text-xs text-slate-500 bg-slate-50">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-700">Firebase Firestore</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Connecté"></span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Multi-plateforme Mobile · Tablette · PC</p>
        </div>
      </aside>

      {/* Mobile Drawer (visible on screens < 1024px when isMobileOpen === true) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />

          {/* Drawer container */}
          <aside className="fixed inset-y-0 left-0 max-w-xs w-4/5 bg-white shadow-2xl flex flex-col z-50 animate-in slide-in-from-left duration-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                  <SchoolIcon className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-sm block">EduFinance Pro</span>
                  <span className="text-[10px] text-slate-400">Navigation Complète</span>
                </div>
              </div>

              <button
                onClick={onCloseMobile}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {renderNavList()}

            {/* Mobile Footer */}
            <div className="p-4 border-t border-slate-200 text-xs text-slate-500 bg-slate-50 shrink-0">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-700">Système Scolaire</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Adapté Mobile & Tablette</p>
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
