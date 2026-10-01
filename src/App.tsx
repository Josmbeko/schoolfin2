import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { Navbar } from './components/common/Navbar';
import { Sidebar, ActiveTab } from './components/common/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { StudentsPage } from './pages/StudentsPage';
import { StudentDetailPage } from './pages/StudentDetailPage';
import { ClassesPage } from './pages/ClassesPage';
import { SectionsPage } from './pages/SectionsPage';
import { OptionsPage } from './pages/OptionsPage';
import { FeeCatalogPage } from './pages/FeeCatalogPage';
import { BillingPage } from './pages/BillingPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { CashRegisterPage } from './pages/CashRegisterPage';
import { ReportsPage } from './pages/ReportsPage';
import { AuditPage } from './pages/AuditPage';
import { UsersPage } from './pages/UsersPage';
import { SettingsPage } from './pages/SettingsPage';
import { FinancialTestsPage } from './pages/FinancialTestsPage';
import { ReceiptModal } from './components/common/ReceiptModal';
import { PaymentModal } from './components/common/PaymentModal';
import { SchoolService } from './services/schoolService';
import { seedInitialDemoData } from './services/seedData';
import {
  School,
  Student,
  UserProfile,
  SectionItem,
  ClassItem,
  OptionItem,
  FeeType,
  StudentCharge,
  Payment,
  CashOperation,
  AuditLog,
  Receipt,
} from './types';
import { Loader2, LayoutDashboard, Users, CreditCard, FileText, Menu } from 'lucide-react';

function MainApp() {
  const { schoolId, role } = useAuth();

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  // Entities
  const [school, setSchool] = useState<School | null>(null);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [options, setOptions] = useState<OptionItem[]>([]);
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [charges, setCharges] = useState<StudentCharge[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [cashOperations, setCashOperations] = useState<CashOperation[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);

  // Navigation / Modal States
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState<Student | null>(null);
  const [studentForPayment, setStudentForPayment] = useState<Student | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<Receipt | null>(null);

  // Fetch all school data
  const fetchData = useCallback(async () => {
    try {
      const data = await SchoolService.fetchAllSchoolData(schoolId);
      setSchool(data.school);
      setSections(data.sections || []);
      setStudents(data.students);
      setClasses(data.classes);
      setOptions(data.options);
      setFeeTypes(data.feeTypes);
      setCharges(data.charges);
      setPayments(data.payments);
      setCashOperations(data.cashOperations);
      setAuditLogs(data.auditLogs);
      setUsers(data.users || []);

      // Auto-seed if brand new
      if (data.students.length === 0 && !seeding) {
        setSeeding(true);
        try {
          await seedInitialDemoData(schoolId);
          const freshData = await SchoolService.fetchAllSchoolData(schoolId);
          setSchool(freshData.school);
          setSections(freshData.sections || []);
          setStudents(freshData.students);
          setClasses(freshData.classes);
          setOptions(freshData.options);
          setFeeTypes(freshData.feeTypes);
          setCharges(freshData.charges);
          setPayments(freshData.payments);
          setCashOperations(freshData.cashOperations);
          setAuditLogs(freshData.auditLogs);
          setUsers(freshData.users || []);
        } catch (e) {
          console.error('Seed error:', e);
        } finally {
          setSeeding(false);
        }
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [schoolId, seeding]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Manual Seed Data Button
  const handleSeedData = async () => {
    setSeeding(true);
    try {
      await seedInitialDemoData(schoolId);
      await fetchData();
      alert('Données de démonstration chargées avec succès !');
    } catch (err) {
      console.error(err);
      alert('Erreur lors du chargement des données démo.');
    } finally {
      setSeeding(false);
    }
  };

  // Open Payment modal helper
  const handleOpenPaymentModal = (student?: Student) => {
    if (student) {
      setStudentForPayment(student);
    } else if (students.length > 0) {
      setStudentForPayment(students[0]);
    } else {
      alert('Veuillez d\'abord inscrire ou sélectionner un élève.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
        <p className="text-sm font-medium text-slate-300">
          Chargement de l'espace financier EduFinance Pro...
        </p>
      </div>
    );
  }

  // Fallback school object if none
  const currentSchool: School = school || {
    id: schoolId,
    name: 'Complexe Scolaire Mgr Bokeleale',
    code: 'CSMB',
    address: 'Avenue de la Paix, Gombe',
    city: 'Kinshasa',
    province: 'Kinshasa',
    country: 'République Démocratique du Congo',
    phone: '+243 81 555 0100',
    email: 'direction@bokeleale.cd',
    currency: 'CDF',
    schoolYear: '2026-2027',
    matriculePrefix: '2026',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        school={currentSchool}
        onSeedData={handleSeedData}
        seeding={seeding}
        onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        isMobileMenuOpen={mobileMenuOpen}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar (Desktop + Mobile Drawer) */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setSelectedStudentForDetail(null);
            setActiveTab(tab);
            setMobileMenuOpen(false);
          }}
          role={role}
          isMobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        {/* Main Workspace Area */}
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          {/* If an individual student dossier is open */}
          {selectedStudentForDetail ? (
            <StudentDetailPage
              student={selectedStudentForDetail}
              school={currentSchool}
              classes={classes}
              options={options}
              sections={sections}
              charges={charges}
              payments={payments}
              onBack={() => setSelectedStudentForDetail(null)}
              onOpenPaymentModal={handleOpenPaymentModal}
              onViewReceipt={(receipt) => setActiveReceipt(receipt)}
              onRefreshData={fetchData}
            />
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardPage
                  school={currentSchool}
                  students={students}
                  charges={charges}
                  payments={payments}
                  classes={classes}
                  sections={sections}
                  feeTypes={feeTypes}
                  onOpenPaymentModal={handleOpenPaymentModal}
                  onNavigateTo={(tab) => setActiveTab(tab)}
                  onViewReceipt={(receipt) => setActiveReceipt(receipt)}
                />
              )}

              {activeTab === 'students' && (
                <StudentsPage
                  school={currentSchool}
                  students={students}
                  classes={classes}
                  options={options}
                  sections={sections}
                  charges={charges}
                  payments={payments}
                  onSelectStudent={(student) => setSelectedStudentForDetail(student)}
                  onOpenPaymentModal={handleOpenPaymentModal}
                  onRefreshData={fetchData}
                />
              )}

              {activeTab === 'classes' && (
                <ClassesPage
                  school={currentSchool}
                  classes={classes}
                  sections={sections}
                  options={options}
                  students={students}
                  onRefreshData={fetchData}
                />
              )}

              {activeTab === 'sections' && (
                <SectionsPage
                  school={currentSchool}
                  sections={sections}
                  classes={classes}
                  students={students}
                  onRefreshData={fetchData}
                />
              )}

              {activeTab === 'options' && (
                <OptionsPage
                  school={currentSchool}
                  options={options}
                  classes={classes}
                  students={students}
                  onRefreshData={fetchData}
                />
              )}

              {activeTab === 'fees' && (
                <FeeCatalogPage
                  school={currentSchool}
                  feeTypes={feeTypes}
                  classes={classes}
                  sections={sections}
                  options={options}
                  onRefreshData={fetchData}
                />
              )}

              {activeTab === 'billing' && (
                <BillingPage
                  school={currentSchool}
                  charges={charges}
                  classes={classes}
                  feeTypes={feeTypes}
                  students={students}
                  onRefreshData={fetchData}
                />
              )}

              {activeTab === 'payments' && (
                <PaymentsPage
                  school={currentSchool}
                  payments={payments}
                  students={students}
                  onOpenPaymentModal={() => handleOpenPaymentModal()}
                  onViewReceipt={(receipt) => setActiveReceipt(receipt)}
                  onRefreshData={fetchData}
                />
              )}

              {activeTab === 'cash' && (
                <CashRegisterPage
                  school={currentSchool}
                  cashOperations={cashOperations}
                  onRefreshData={fetchData}
                />
              )}

              {activeTab === 'reports' && (
                <ReportsPage
                  school={currentSchool}
                  students={students}
                  charges={charges}
                  payments={payments}
                  classes={classes}
                  feeTypes={feeTypes}
                />
              )}

              {activeTab === 'audit' && (
                <AuditPage
                  school={currentSchool}
                  auditLogs={auditLogs}
                />
              )}

              {activeTab === 'users' && (
                <UsersPage
                  school={currentSchool}
                  users={users}
                  onRefreshData={fetchData}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsPage
                  school={currentSchool}
                  onRefreshData={fetchData}
                  onNavigateToUsers={() => setActiveTab('users')}
                />
              )}

              {activeTab === 'tests' && (
                <FinancialTestsPage
                  school={currentSchool}
                  students={students}
                  charges={charges}
                  payments={payments}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Payment Modal */}
      {studentForPayment && (
        <PaymentModal
          student={studentForPayment}
          charges={charges.filter(c => c.studentId === studentForPayment.id)}
          currency={currentSchool.currency || 'CDF'}
          school={currentSchool}
          classes={classes}
          feeTypes={feeTypes}
          onSuccess={async (_payment, receipt) => {
            setStudentForPayment(null);
            await fetchData();
            setActiveReceipt(receipt);
          }}
          onClose={() => setStudentForPayment(null)}
        />
      )}

      {/* Official Receipt Modal (Print & PDF) */}
      {activeReceipt && (
        <ReceiptModal
          receipt={activeReceipt}
          school={currentSchool}
          onClose={() => setActiveReceipt(null)}
        />
      )}

      {/* Mobile Bottom Quick-Access Bar (Screens < 1024px) */}
      <nav className="no-print lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-1.5 flex items-center justify-around shadow-lg">
        <button
          onClick={() => {
            setSelectedStudentForDetail(null);
            setActiveTab('dashboard');
            setMobileMenuOpen(false);
          }}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer ${
            activeTab === 'dashboard' && !selectedStudentForDetail
              ? 'text-indigo-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Tableau</span>
        </button>

        <button
          onClick={() => {
            setSelectedStudentForDetail(null);
            setActiveTab('students');
            setMobileMenuOpen(false);
          }}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer ${
            activeTab === 'students' || selectedStudentForDetail
              ? 'text-indigo-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Élèves</span>
        </button>

        <button
          onClick={() => {
            setSelectedStudentForDetail(null);
            setActiveTab('payments');
            setMobileMenuOpen(false);
          }}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer ${
            activeTab === 'payments' && !selectedStudentForDetail
              ? 'text-indigo-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Caisse</span>
        </button>

        <button
          onClick={() => {
            setSelectedStudentForDetail(null);
            setActiveTab('billing');
            setMobileMenuOpen(false);
          }}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer ${
            activeTab === 'billing' && !selectedStudentForDetail
              ? 'text-indigo-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Factures</span>
        </button>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer ${
            mobileMenuOpen ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Menu className="w-4 h-4" />
          <span>Menu</span>
        </button>
      </nav>
    </div>
  );
}

function AuthenticatedApp() {
  const { currentUser, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!currentUser || !profile) return <LoginPage />;
  return <MainApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}
