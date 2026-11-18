import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  CheckCircle2,
  LogIn,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { auth, googleAuthProvider } from '../lib/firebase';
import {
  AdminOverview,
  AppointmentRecord,
  ComplaintRecord,
  Department,
  FacultyMember,
  VisitorRecord,
} from '../types/visiondesk';

type AdminTab = 'visitors' | 'appointments' | 'complaints' | 'directory' | 'activity';

interface AdminDashboardProps {
  departments: Department[];
  facultyList: FacultyMember[];
  onRefreshPublicData: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  departments,
  facultyList,
  onRefreshPublicData,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [adminVerified, setAdminVerified] = useState(false);  // new line
  const [accessDenied, setAccessDenied] = useState(false);  // new line
  const tokenRef = useRef<string | null>(null);

  const [activeTab, setActiveTab] = useState<AdminTab>('visitors');
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [visitors, setVisitors] = useState<VisitorRecord[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);

  const [visitorFilter, setVisitorFilter] = useState<'all' | 'checked_in' | 'checked_out'>('all');
  const [visitorSearch, setVisitorSearch] = useState('');

  // Walk-in Check-In Modal State
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [walkInName, setWalkInName] = useState('');
  const [walkInMobile, setWalkInMobile] = useState('');
  const [walkInPurpose, setWalkInPurpose] = useState('');
  const [walkInDept, setWalkInDept] = useState(
    departments[0]?.name || 'Admissions & Counseling Cell'
  );

  // Add Faculty Modal State
  const [showAddFaculty, setShowAddFaculty] = useState(false);
  const [facName, setFacName] = useState('');
  const [facDesignation, setFacDesignation] = useState('');
  const [facDeptId, setFacDeptId] = useState(String(departments[0]?.id || 1));
  const [facCabin, setFacCabin] = useState('');
  const [facHours, setFacHours] = useState('Mon-Sat, 10:00 AM - 4:00 PM');
  const [facEmail, setFacEmail] = useState('');
  const [facSpec, setFacSpec] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        tokenRef.current = await currentUser.getIdToken();
      } else {
        tokenRef.current = null;
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const authFetch = useCallback(async (url: string, init: RequestInit = {}) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Administrator authentication required.');
    const token = await currentUser.getIdToken();
    tokenRef.current = token;
    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Admin request failed.');
    return data;
  }, []);

  // const loadAllAdminData = useCallback(async () => {
  //   if (!auth.currentUser) return;
  //   setLoadingData(true);
  //   setDataError(null);
  //   try {
  //     const [ovData, visData, aptData, cmpData] = await Promise.all([
  //       authFetch('/api/admin/overview'),
  //       authFetch('/api/admin/visitors'),
  //       authFetch('/api/admin/appointments'),
  //       authFetch('/api/admin/complaints'),
  //     ]);
  //     setOverview(ovData);
  //     setVisitors(visData.visitors || []);
  //     setAppointments(aptData.appointments || []);
  //     setComplaints(cmpData.complaints || []);
  //   } catch (err: unknown) {
  //     setDataError(err instanceof Error ? err.message : 'Unable to load admin records.');
  //   } finally {
  //     setLoadingData(false);
  //   }
  // }, [authFetch]);

const loadAllAdminData = useCallback(async () => {
  if (!auth.currentUser) return;

  setLoadingData(true);
  setDataError(null);

  try {
    const [ovData, visData, aptData, cmpData] = await Promise.all([
      authFetch('/api/admin/overview'),
      authFetch('/api/admin/visitors'),
      authFetch('/api/admin/appointments'),
      authFetch('/api/admin/complaints'),
    ]);

    setOverview(ovData);
    setVisitors(visData.visitors || []);
    setAppointments(aptData.appointments || []);
    setComplaints(cmpData.complaints || []);

    setAccessDenied(false);
    setAdminVerified(true);

  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : 'Unable to load admin records.';

    if (
      message.toLowerCase().includes('forbidden') ||
      message.toLowerCase().includes('not an authorized administrator')
    ) {
      setAccessDenied(true);
      setAdminVerified(false);
      setOverview(null);
      setVisitors([]);
      setAppointments([]);
      setComplaints([]);
    } else {
      setDataError(message);
      setAdminVerified(true);
    }

  } finally {
    setLoadingData(false);
  }
}, [authFetch]);


  useEffect(() => {
    if (user) {
      loadAllAdminData();
    }
  }, [user, loadAllAdminData]);

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      tokenRef.current = await cred.user.getIdToken();
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Google Sign-In failed.');
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    tokenRef.current = null;
    setOverview(null);
  };

  const handleCheckoutVisitor = async (id: number) => {
    try {
      await authFetch(`/api/admin/visitors/${id}/checkout`, { method: 'POST' });
      await loadAllAdminData();
    } catch (err: unknown) {
      setDataError(err instanceof Error ? err.message : 'Failed to check out visitor.');
    }
  };

  const handleWalkInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await authFetch('/api/admin/visitors', {
        method: 'POST',
        body: JSON.stringify({
          fullName: walkInName,
          mobileNumber: walkInMobile,
          purpose: walkInPurpose,
          departmentQuery: walkInDept,
        }),
      });
      setShowWalkIn(false);
      setWalkInName('');
      setWalkInMobile('');
      setWalkInPurpose('');
      await loadAllAdminData();
    } catch (err: unknown) {
      setDataError(err instanceof Error ? err.message : 'Walk-in check-in failed.');
    }
  };

  const handleAppointmentDecision = async (
    id: number,
    status: 'approved' | 'rejected' | 'completed'
  ) => {
    try {
      await authFetch(`/api/admin/appointments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await loadAllAdminData();
    } catch (err: unknown) {
      setDataError(err instanceof Error ? err.message : 'Failed to update appointment.');
    }
  };

  const handleComplaintStatus = async (
    id: number,
    status: 'open' | 'in_review' | 'resolved'
  ) => {
    try {
      await authFetch(`/api/admin/complaints/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await loadAllAdminData();
    } catch (err: unknown) {
      setDataError(err instanceof Error ? err.message : 'Failed to update complaint.');
    }
  };

  const handleToggleFaculty = async (id: number, current: boolean) => {
    try {
      await authFetch(`/api/admin/faculty/${id}/availability`, {
        method: 'PATCH',
        body: JSON.stringify({ isAvailable: !current }),
      });
      onRefreshPublicData();
    } catch (err: unknown) {
      setDataError(err instanceof Error ? err.message : 'Failed to toggle availability.');
    }
  };

  const handleCreateFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await authFetch('/api/admin/faculty', {
        method: 'POST',
        body: JSON.stringify({
          name: facName,
          designation: facDesignation,
          departmentId: Number(facDeptId),
          cabinNumber: facCabin,
          availabilityHours: facHours,
          email: facEmail,
          specialization: facSpec,
        }),
      });
      setShowAddFaculty(false);
      setFacName('');
      setFacDesignation('');
      setFacCabin('');
      setFacEmail('');
      setFacSpec('');
      onRefreshPublicData();
    } catch (err: unknown) {
      setDataError(err instanceof Error ? err.message : 'Failed to add faculty member.');
    }
  };

  const filteredVisitors = useMemo(() => {
    return visitors.filter((v) => {
      if (visitorFilter !== 'all' && v.status !== visitorFilter) return false;
      if (!visitorSearch.trim()) return true;
      const q = visitorSearch.toLowerCase();
      return (
        v.fullName.toLowerCase().includes(q) ||
        v.visitorCode.toLowerCase().includes(q) ||
        v.mobileNumber.includes(q) ||
        v.departmentName.toLowerCase().includes(q)
      );
    });
  }, [visitors, visitorFilter, visitorSearch]);

  if (!authReady) {
    return (
      <div className="mx-auto max-w-6xl py-16 text-center text-sm text-slate-400">
        Verifying administrator session...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md py-12">
        <div className="rounded-xl border border-slate-800 bg-[#0C1729] p-8 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-sky-400" />
          <h2 className="mt-4 text-xl font-semibold text-white">
            Reception Administration Portal
          </h2>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            Sign in with an authorized Career Point University administrator account to manage visitor check-ins, appointment approvals, complaints, and analytics.
          </p>
          {authError && (
            <div className="mt-4 rounded-lg border border-red-800/60 bg-red-950/40 p-3 text-xs text-red-200">
              {authError}
            </div>
          )}
          <button
            type="button"
            onClick={handleSignIn}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 transition-colors"
          >
            <LogIn className="h-4 w-4" />
            <span>Sign In with Google</span>
          </button>
        </div>
      </div>
    );
  }


if (user && !adminVerified && !accessDenied) {
  return (
    <div className="mx-auto max-w-6xl py-16 text-center text-sm text-slate-400">
      Verifying administrator permissions...
    </div>
  );
}

if (accessDenied) {
  return (
    <div className="mx-auto max-w-md py-16">
      <div className="rounded-xl border border-red-800/60 bg-[#0C1729] p-8 text-center">
        <XCircle className="mx-auto h-12 w-12 text-red-400" />

        <h2 className="mt-4 text-xl font-semibold text-white">
          Access Denied
        </h2>

        <p className="mt-2 text-sm text-slate-300">
          Your Google account is not authorized to access the
          Career Point University Admin Portal.
        </p>

        <button
          type="button"
          onClick={handleSignOut}
          className="mt-6 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

  const maxDeptCount = Math.max(
    1,
    ...(overview?.departmentBreakdown.map((d) => d.count) || [1])
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Admin Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-[#0C1729] p-5">
        <div>
          <p className="text-xs text-sky-400">
            Reception Operations Console · {user.email}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">
            Career Point University Admin Dashboard
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowWalkIn(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-sky-500 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Walk-In Check-In</span>
          </button>
          <button
            type="button"
            onClick={loadAllAdminData}
            disabled={loadingData}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#060D1A] px-3 py-2 text-xs font-medium text-slate-200 hover:border-sky-500/50 transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingData ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#060D1A] px-3 py-2 text-xs font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {dataError && (
        <div className="rounded-xl border border-red-800/60 bg-red-950/40 px-4 py-3 text-xs text-red-200">
          {dataError}
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-[#0C1729] p-5">
          <div className="text-xs text-slate-400">Total Visitors</div>
          <div className="mt-2 font-display text-3xl font-semibold text-white tabular-nums">
            {overview?.summary.totalVisitors ?? 0}
          </div>
          <div className="mt-1 text-xs text-slate-400 tabular-nums">
            {overview?.summary.checkedOutVisitors ?? 0} completed visits
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0C1729] p-5">
          <div className="text-xs text-slate-400">Active on Campus</div>
          <div className="mt-2 font-display text-3xl font-semibold text-emerald-400 tabular-nums">
            {overview?.summary.activeVisitors ?? 0}
          </div>
          <div className="mt-1 text-xs text-slate-400">Currently checked in</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0C1729] p-5">
          <div className="text-xs text-slate-400">Pending Appointments</div>
          <div className="mt-2 font-display text-3xl font-semibold text-amber-400 tabular-nums">
            {overview?.summary.pendingAppointments ?? 0}
          </div>
          <div className="mt-1 text-xs text-slate-400 tabular-nums">
            {overview?.summary.totalAppointments ?? 0} total requests
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0C1729] p-5">
          <div className="text-xs text-slate-400">Open Complaints</div>
          <div className="mt-2 font-display text-3xl font-semibold text-sky-400 tabular-nums">
            {overview?.summary.openComplaints ?? 0}
          </div>
          <div className="mt-1 text-xs text-slate-400 tabular-nums">
            {overview?.summary.totalComplaints ?? 0} total tickets
          </div>
        </div>
      </div>

      {/* Visitor Analytics Strip */}
      {overview && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-8 rounded-xl border border-slate-800 bg-[#0C1729] p-5">
            <h3 className="text-sm font-semibold text-white">Department Footfall Analytics</h3>
            <div className="mt-4 space-y-3">
              {overview.departmentBreakdown.length === 0 ? (
                <p className="text-xs text-slate-400">No visitor traffic recorded yet.</p>
              ) : (
                overview.departmentBreakdown.map((item) => (
                  <div key={item.departmentName} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-200 truncate pr-4">{item.departmentName}</span>
                      <span className="font-mono text-slate-300 tabular-nums">{item.count}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[#060D1A] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-sky-500"
                        style={{ width: `${Math.round((item.count / maxDeptCount) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="lg:col-span-4 rounded-xl border border-slate-800 bg-[#0C1729] p-5">
            <h3 className="text-sm font-semibold text-white">Visitor Language Mix</h3>
            <div className="mt-4 divide-y divide-slate-800/80">
              {overview.languageBreakdown.map((lang) => (
                <div
                  key={lang.language}
                  className="flex items-center justify-between py-2.5 text-sm"
                >
                  <span className="text-slate-200">{lang.language}</span>
                  <span className="font-mono text-sky-400 tabular-nums">{lang.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Segmented Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-800 bg-[#0C1729] p-1.5 w-fit">
        {(
          [
            ['visitors', 'Visitors & History'],
            ['appointments', 'Appointments'],
            ['complaints', 'Complaints'],
            ['directory', 'Directory & Faculty'],
            ['activity', 'Activity Log'],
          ] as Array<[AdminTab, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === key
                ? 'bg-sky-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'visitors' && (
        <div className="rounded-xl border border-slate-800 bg-[#0C1729] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-800">
            <div className="relative flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={visitorSearch}
                onChange={(e) => setVisitorSearch(e.target.value)}
                placeholder="Search visitor name, code, mobile..."
                className="w-full rounded-lg border border-slate-700 bg-[#060D1A] pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#060D1A] p-1">
              {(['all', 'checked_in', 'checked_out'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setVisitorFilter(status)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    visitorFilter === status
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {status === 'all'
                    ? 'All'
                    : status === 'checked_in'
                    ? 'Checked In'
                    : 'Checked Out'}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 pr-4 font-medium">Visitor ID</th>
                  <th className="py-2.5 pr-4 font-medium">Visitor</th>
                  <th className="py-2.5 pr-4 font-medium">Department &amp; Purpose</th>
                  <th className="py-2.5 pr-4 font-medium">Check-In</th>
                  <th className="py-2.5 pr-4 font-medium">Status</th>
                  <th className="py-2.5 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filteredVisitors.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-900/40">
                    <td className="py-3 pr-4 font-mono text-sky-400 tabular-nums whitespace-nowrap">
                      {v.visitorCode}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="font-medium text-white">{v.fullName}</div>
                      <div className="font-mono text-slate-400 tabular-nums">{v.mobileNumber}</div>
                    </td>
                    <td className="py-3 pr-4 max-w-xs">
                      <div className="text-slate-200">{v.departmentName}</div>
                      <div className="text-slate-400 truncate">{v.purpose}</div>
                    </td>
                    <td className="py-3 pr-4 font-mono text-slate-300 tabular-nums whitespace-nowrap">
                      {new Date(v.checkInTime).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {v.status === 'checked_in' ? (
                        <span className="text-emerald-400 font-medium">Checked In</span>
                      ) : (
                        <span className="text-slate-400">Checked Out</span>
                      )}
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      {v.status === 'checked_in' ? (
                        <button
                          type="button"
                          onClick={() => handleCheckoutVisitor(v.id)}
                          className="rounded-md border border-slate-700 bg-[#060D1A] px-2.5 py-1 text-xs text-slate-200 hover:border-sky-500/60 hover:text-white"
                        >
                          Check Out
                        </button>
                      ) : (
                        <span className="font-mono text-slate-500 tabular-nums">
                          {v.checkOutTime
                            ? new Date(v.checkOutTime).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'appointments' && (
        <div className="rounded-xl border border-slate-800 bg-[#0C1729] p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 pr-4 font-medium">Code</th>
                  <th className="py-2.5 pr-4 font-medium">Visitor</th>
                  <th className="py-2.5 pr-4 font-medium">Faculty &amp; Department</th>
                  <th className="py-2.5 pr-4 font-medium">Requested Slot</th>
                  <th className="py-2.5 pr-4 font-medium">Status</th>
                  <th className="py-2.5 text-right font-medium">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {appointments.map((apt) => (
                  <tr key={apt.id} className="hover:bg-slate-900/40">
                    <td className="py-3 pr-4 font-mono text-sky-400 tabular-nums">
                      {apt.appointmentCode}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="font-medium text-white">{apt.visitorName}</div>
                      <div className="font-mono text-slate-400 tabular-nums">
                        {apt.visitorMobile}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="text-slate-100">{apt.facultyName}</div>
                      <div className="text-slate-400">{apt.purpose}</div>
                    </td>
                    <td className="py-3 pr-4 font-mono text-slate-300 tabular-nums whitespace-nowrap">
                      {apt.preferredDate} · {apt.preferredTime}
                    </td>
                    <td className="py-3 pr-4 capitalize">
                      <span
                        className={
                          apt.status === 'approved'
                            ? 'text-emerald-400 font-medium'
                            : apt.status === 'rejected'
                            ? 'text-red-400 font-medium'
                            : apt.status === 'completed'
                            ? 'text-sky-400 font-medium'
                            : 'text-amber-400 font-medium'
                        }
                      >
                        {apt.status}
                      </span>
                    </td>
                    <td className="py-3 text-right whitespace-nowrap space-x-2">
                      {apt.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleAppointmentDecision(apt.id, 'approved')}
                            className="inline-flex items-center gap-1 rounded-md border border-emerald-700/60 bg-emerald-950/40 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-800/40"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Approve</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAppointmentDecision(apt.id, 'rejected')}
                            className="inline-flex items-center gap-1 rounded-md border border-red-800/60 bg-red-950/40 px-2.5 py-1 text-xs text-red-300 hover:bg-red-900/40"
                          >
                            <XCircle className="h-3 w-3" />
                            <span>Reject</span>
                          </button>
                        </>
                      )}
                      {apt.status === 'approved' && (
                        <button
                          type="button"
                          onClick={() => handleAppointmentDecision(apt.id, 'completed')}
                          className="rounded-md border border-slate-700 bg-[#060D1A] px-2.5 py-1 text-xs text-slate-200 hover:border-sky-500/50"
                        >
                          Mark Completed
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'complaints' && (
        <div className="rounded-xl border border-slate-800 bg-[#0C1729] p-5">
          <div className="divide-y divide-slate-800/80">
            {complaints.map((cmp) => (
              <div
                key={cmp.id}
                className="py-4 first:pt-1 last:pb-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="font-mono text-sky-400 tabular-nums">{cmp.ticketCode}</span>
                    <span aria-hidden="true">·</span>
                    <span>{cmp.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{cmp.complainantName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{cmp.mobileNumber}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-slate-100">{cmp.description}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={cmp.status}
                    onChange={(e) =>
                      handleComplaintStatus(
                        cmp.id,
                        e.target.value as 'open' | 'in_review' | 'resolved'
                      )
                    }
                    className="rounded-lg border border-slate-700 bg-[#060D1A] px-3 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
                  >
                    <option value="open">Open</option>
                    <option value="in_review">In Review</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'directory' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-[#0C1729] p-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-white">Faculty Availability Control</h3>
              <button
                type="button"
                onClick={() => setShowAddFaculty(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500 whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Faculty</span>
              </button>
            </div>
            <div className="mt-3 divide-y divide-slate-800/70">
              {facultyList.map((f) => (
                <div
                  key={f.id}
                  className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-medium text-white text-sm">{f.name}</div>
                    <div className="text-slate-400">
                      {f.designation} · {f.departmentName} · Cabin {f.cabinNumber}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleFaculty(f.id, f.isAvailable)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      f.isAvailable
                        ? 'border-emerald-700/60 bg-emerald-950/40 text-emerald-300'
                        : 'border-amber-700/60 bg-amber-950/40 text-amber-300'
                    }`}
                  >
                    {f.isAvailable ? 'Available (Set In Meeting)' : 'In Meeting (Set Available)'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0C1729] p-5">
            <h3 className="text-sm font-semibold text-white border-b border-slate-800 pb-3">
              Registered Campus Departments ({departments.length})
            </h3>
            <div className="mt-3 divide-y divide-slate-800/70 text-xs">
              {departments.map((d) => (
                <div key={d.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-white">
                      {d.code} · {d.name}
                    </div>
                    <div className="text-slate-400 mt-0.5">
                      {d.building}, {d.floor}, {d.roomNumber} · HoD: {d.headOfDepartment}
                    </div>
                  </div>
                  <span className="font-mono text-slate-300 tabular-nums">{d.officeHours}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'activity' && overview && (
        <div className="rounded-xl border border-slate-800 bg-[#0C1729] p-5">
          <h3 className="text-sm font-semibold text-white border-b border-slate-800 pb-3">
            Recent Reception Activity Log
          </h3>
          <div className="mt-3 divide-y divide-slate-800/70 text-xs">
            {overview.recentActivity.map((act) => (
              <div key={act.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="font-medium text-white">{act.actorName}</span>
                  <span className="text-slate-400"> — {act.summary}</span>
                </div>
                <div className="flex items-center gap-3 font-mono text-slate-400 tabular-nums">
                  {act.referenceCode && <span className="text-sky-400">{act.referenceCode}</span>}
                  <span>
                    {new Date(act.createdAt).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Walk-In Check-In Modal */}
      {showWalkIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-[#0C1729] p-6">
            <h3 className="text-base font-semibold text-white">Walk-In Visitor Check-In</h3>
            <form onSubmit={handleWalkInSubmit} className="mt-4 space-y-3">
              <input
                type="text"
                required
                placeholder="Full Name"
                value={walkInName}
                onChange={(e) => setWalkInName(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#060D1A] px-3 py-2 text-sm text-white"
              />
              <input
                type="tel"
                required
                placeholder="Mobile Number"
                value={walkInMobile}
                onChange={(e) => setWalkInMobile(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#060D1A] px-3 py-2 text-sm text-white"
              />
              <select
                value={walkInDept}
                onChange={(e) => setWalkInDept(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#060D1A] px-3 py-2 text-sm text-white"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                required
                placeholder="Purpose of Visit"
                value={walkInPurpose}
                onChange={(e) => setWalkInPurpose(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#060D1A] px-3 py-2 text-sm text-white"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWalkIn(false)}
                  className="rounded-lg border border-slate-700 px-3.5 py-2 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-medium text-white"
                >
                  Issue Pass
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Faculty Modal */}
      {showAddFaculty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-[#0C1729] p-6">
            <h3 className="text-base font-semibold text-white">Add Faculty Member</h3>
            <form onSubmit={handleCreateFaculty} className="mt-4 space-y-3">
              <input
                type="text"
                required
                placeholder="Full Name (e.g. Dr. Rakesh Sharma)"
                value={facName}
                onChange={(e) => setFacName(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#060D1A] px-3 py-2 text-sm text-white"
              />
              <input
                type="text"
                required
                placeholder="Designation"
                value={facDesignation}
                onChange={(e) => setFacDesignation(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#060D1A] px-3 py-2 text-sm text-white"
              />
              <select
                value={facDeptId}
                onChange={(e) => setFacDeptId(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#060D1A] px-3 py-2 text-sm text-white"
              >
                {departments.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Cabin (e.g. A-210)"
                  value={facCabin}
                  onChange={(e) => setFacCabin(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-[#060D1A] px-3 py-2 text-sm text-white"
                />
                <input
                  type="email"
                  required
                  placeholder="Email"
                  value={facEmail}
                  onChange={(e) => setFacEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-[#060D1A] px-3 py-2 text-sm text-white"
                />
              </div>
              <input
                type="text"
                required
                placeholder="Availability Hours"
                value={facHours}
                onChange={(e) => setFacHours(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#060D1A] px-3 py-2 text-sm text-white"
              />
              <input
                type="text"
                required
                placeholder="Specialization"
                value={facSpec}
                onChange={(e) => setFacSpec(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#060D1A] px-3 py-2 text-sm text-white"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddFaculty(false)}
                  className="rounded-lg border border-slate-700 px-3.5 py-2 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-medium text-white"
                >
                  Save Faculty
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
