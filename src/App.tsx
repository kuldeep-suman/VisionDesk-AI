import { useCallback, useEffect, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { DepartmentsDirectory } from './components/DepartmentsDirectory';
import { FacultyDirectory } from './components/FacultyDirectory';
import { QuickModalType, QuickOperationModals } from './components/QuickOperationModals';
import { ReceptionDesk } from './components/ReceptionDesk';
import {
  AppView,
  Department,
  ExecutedOperation,
  FacultyMember,
} from './types/visiondesk';

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('reception');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [facultyList, setFacultyList] = useState<FacultyMember[]>([]);
  const [loadingDirectory, setLoadingDirectory] = useState(true);

  const [modalType, setModalType] = useState<QuickModalType>(null);
  const [modalFacultyName, setModalFacultyName] = useState<string | undefined>(undefined);
  const [pendingQuickPrompt, setPendingQuickPrompt] = useState<string | null>(null);
  const [latestOperation, setLatestOperation] = useState<ExecutedOperation | null>(null);

  const loadDirectoryData = useCallback(async () => {
    setLoadingDirectory(true);
    try {
      const [deptRes, facRes] = await Promise.all([
        fetch('/api/reception/departments'),
        fetch('/api/reception/faculty'),
      ]);
      if (deptRes.ok) {
        const d = await deptRes.json();
        setDepartments(d.departments || []);
      }
      if (facRes.ok) {
        const f = await facRes.json();
        setFacultyList(f.faculty || []);
      }
    } catch (err) {
      console.error('Failed to load university directory:', err);
    } finally {
      setLoadingDirectory(false);
    }
  }, []);

  useEffect(() => {
    loadDirectoryData();
  }, [loadDirectoryData]);

  const handleOpenAppointmentForFaculty = (facultyName: string) => {
    setModalFacultyName(facultyName);
    setModalType('appointment');
  };

  const handleAskDirections = (departmentName: string) => {
    setActiveView('reception');
    setPendingQuickPrompt(
      `Please give me verified directions and office timings for ${departmentName}.`
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#060D1A] text-slate-100">
      {/* Three-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#060D1A]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 sm:px-6 py-3.5">
          {/* Zone 1: Single-line Brand Mark */}
          <button
            type="button"
            onClick={() => setActiveView('reception')}
            className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-md"
          >
            <img
              src="/src/assets/images/visiondesk_emblem_1794839188621.jpg"
              alt="VisionDesk AI Crest"
              referrerPolicy="no-referrer"
              className="h-8 w-8 rounded-md object-cover border border-slate-800"
            />
            <span className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0">
              VisionDesk AI
            </span>
          </button>

          {/* Zone 2: Concise Single-Line Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {(
              [
                ['reception', 'Reception Desk'],
                ['departments', 'Departments'],
                ['faculty', 'Faculty Directory'],
                ['admin', 'Admin Portal'],
              ] as Array<[AppView, string]>
            ).map(([view, label]) => (
              <button
                key={view}
                type="button"
                onClick={() => setActiveView(view)}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                  activeView === view
                    ? 'border-sky-500 text-white'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => {
                setModalFacultyName(undefined);
                setModalType('register');
              }}
              className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-500 transition-colors whitespace-nowrap shrink-0"
            >
              Register Visitor
            </button>
          </div>
        </div>

        {/* Mobile Nav Row */}
        <div className="flex md:hidden items-center justify-around border-t border-slate-800/70 px-2 py-2 text-xs">
          {(
            [
              ['reception', 'Reception'],
              ['departments', 'Departments'],
              ['faculty', 'Faculty'],
              ['admin', 'Admin'],
            ] as Array<[AppView, string]>
          ).map(([view, label]) => (
            <button
              key={view}
              type="button"
              onClick={() => setActiveView(view)}
              className={`px-2.5 py-1.5 rounded-md font-medium whitespace-nowrap ${
                activeView === view ? 'bg-sky-600/20 text-sky-300' : 'text-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 sm:px-6 py-6 sm:py-8">
        {activeView === 'reception' && (
          <ReceptionDesk
            departments={departments}
            facultyList={facultyList}
            pendingQuickPrompt={pendingQuickPrompt}
            onConsumeQuickPrompt={() => setPendingQuickPrompt(null)}
            onOpenModal={(type) => {
              setModalFacultyName(undefined);
              setModalType(type);
            }}
            onNavigate={(view) => setActiveView(view)}
            latestOperation={latestOperation}
            onOperationResult={(op) => setLatestOperation(op)}
          />
        )}

        {activeView === 'departments' && (
          <DepartmentsDirectory
            departments={departments}
            loading={loadingDirectory}
            onAskDirections={handleAskDirections}
          />
        )}

        {activeView === 'faculty' && (
          <FacultyDirectory
            facultyList={facultyList}
            departments={departments}
            loading={loadingDirectory}
            onRequestAppointment={handleOpenAppointmentForFaculty}
          />
        )}

        {activeView === 'admin' && (
          <AdminDashboard
            departments={departments}
            facultyList={facultyList}
            onRefreshPublicData={loadDirectoryData}
          />
        )}
      </main>

      {/* Clean Institutional Footer */}
      <footer className="border-t border-slate-800/80 bg-[#060D1A] px-4 sm:px-6 py-5">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs text-slate-400">
          <div>
            Career Point University, Kota, Rajasthan · Multimodal Intelligent Reception &amp; Visitor Assistant System
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveView('departments')}
              className="hover:text-white transition-colors"
            >
              Campus Wayfinding
            </button>
            <button
              type="button"
              onClick={() => setModalType('checkout')}
              className="hover:text-white transition-colors"
            >
              Visitor Check-Out
            </button>
            <button
              type="button"
              onClick={() => setActiveView('admin')}
              className="hover:text-white transition-colors"
            >
              Staff Admin
            </button>
          </div>
        </div>
      </footer>

      <QuickOperationModals
        modalType={modalType}
        departments={departments}
        facultyList={facultyList}
        initialFacultyName={modalFacultyName}
        onClose={() => setModalType(null)}
        onOperationSuccess={(op) => {
          setLatestOperation(op);
          setActiveView('reception');
        }}
      />
    </div>
  );
}
