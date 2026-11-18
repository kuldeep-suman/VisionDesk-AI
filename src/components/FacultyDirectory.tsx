import React, { useMemo, useState } from 'react';
import { CalendarPlus, Mail, MapPin, Search } from 'lucide-react';
import { Department, FacultyMember } from '../types/visiondesk';

interface FacultyDirectoryProps {
  facultyList: FacultyMember[];
  departments: Department[];
  loading: boolean;
  onRequestAppointment: (facultyName: string) => void;
}

export const FacultyDirectory: React.FC<FacultyDirectoryProps> = ({
  facultyList,
  departments,
  loading,
  onRequestAppointment,
}) => {
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');

  const filtered = useMemo(() => {
    return facultyList.filter((f) => {
      if (selectedDept !== 'all' && String(f.departmentId) !== selectedDept) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        f.name.toLowerCase().includes(q) ||
        f.designation.toLowerCase().includes(q) ||
        f.departmentName.toLowerCase().includes(q) ||
        f.specialization.toLowerCase().includes(q)
      );
    });
  }, [facultyList, search, selectedDept]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="rounded-xl border border-slate-800/80 bg-[#0C1729] p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-medium text-sky-400">
              Career Point University · Academic &amp; Administrative Leadership
            </p>
            <h2 className="mt-1.5 text-2xl font-semibold text-white">Faculty Directory</h2>
            <p className="mt-1 text-sm text-slate-300">
              Search Deans, Heads of Department, and faculty advisors to verify office hours or submit an appointment request.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search faculty or subject..."
                className="w-full sm:w-64 rounded-lg border border-slate-700 bg-[#060D1A] pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
              />
            </div>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="rounded-lg border border-slate-700 bg-[#060D1A] px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="h-44 animate-pulse rounded-xl border border-slate-800 bg-[#0C1729]"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-[#0C1729] p-10 text-center text-sm text-slate-300">
          No faculty members match your search criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((member) => (
            <div
              key={member.id}
              className="flex flex-col justify-between rounded-xl border border-slate-800/90 bg-[#0C1729] p-5 hover:border-sky-700/60 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono text-sky-400">{member.departmentCode}</span>
                  <span
                    className={
                      member.isAvailable
                        ? 'text-emerald-400 font-medium'
                        : 'text-amber-400 font-medium'
                    }
                  >
                    {member.isAvailable ? 'Available' : 'In Meeting'}
                  </span>
                </div>

                <h3 className="mt-2 text-base font-semibold text-white">{member.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{member.designation}</p>
                <p className="mt-2 text-xs text-slate-300">{member.departmentName}</p>
                <p className="mt-1.5 text-xs text-slate-400">{member.specialization}</p>
              </div>

              <div className="mt-4 space-y-3 border-t border-slate-800/80 pt-3">
                <div className="flex flex-col gap-1 text-xs text-slate-300">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                    Cabin {member.cabinNumber} · {member.building}
                  </span>
                  <span className="text-slate-400 tabular-nums">{member.availabilityHours}</span>
                  <span className="inline-flex items-center gap-1.5 text-slate-400 truncate">
                    <Mail className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    {member.email}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onRequestAppointment(member.name)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600/20 border border-sky-500/30 px-3 py-2 text-xs font-medium text-sky-200 hover:bg-sky-600 hover:text-white transition-colors whitespace-nowrap"
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  <span>Request Appointment</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
