import React, { useMemo, useState } from 'react';
import { Clock, Compass, MapPin, Phone, Search, User } from 'lucide-react';
import { Department } from '../types/visiondesk';

interface DepartmentsDirectoryProps {
  departments: Department[];
  loading: boolean;
  onAskDirections: (departmentName: string) => void;
}

export const DepartmentsDirectory: React.FC<DepartmentsDirectoryProps> = ({
  departments,
  loading,
  onAskDirections,
}) => {
  const [search, setSearch] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('All');

  const buildings = useMemo(() => {
    const unique = Array.from(new Set(departments.map((d) => d.building)));
    return ['All', ...unique];
  }, [departments]);

  const filtered = useMemo(() => {
    return departments.filter((dept) => {
      if (buildingFilter !== 'All' && dept.building !== buildingFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        dept.name.toLowerCase().includes(q) ||
        dept.code.toLowerCase().includes(q) ||
        dept.description.toLowerCase().includes(q) ||
        dept.headOfDepartment.toLowerCase().includes(q)
      );
    });
  }, [departments, search, buildingFilter]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-between rounded-xl border border-slate-800/80 bg-[#0C1729] p-6">
          <div>
            <p className="text-xs font-medium text-sky-400">
              Career Point University · Alaniya, Kota Campus
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white text-balance">
              Verified Campus Departments &amp; Wayfinding
            </h2>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed max-w-2xl">
              Locate academic schools, admissions counseling, examination cell, accounts counters, and student welfare offices with verified room numbers and step-by-step walking routes from the Main Reception Atrium.
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search department, code, or Head of Department..."
                className="w-full rounded-lg border border-slate-700 bg-[#060D1A] pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-[#060D1A] p-1 border border-slate-800">
              {buildings.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBuildingFilter(b)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    buildingFilter === b
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 overflow-hidden rounded-xl border border-slate-800/80 bg-[#0C1729]">
          <img
            src="/src/assets/images/campus_wayfinding_preview_1794839191202.jpg"
            alt="Career Point University Kota campus isometric wayfinding layout"
            referrerPolicy="no-referrer"
            className="h-full min-h-[220px] w-full object-cover"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-48 animate-pulse rounded-xl border border-slate-800 bg-[#0C1729]"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-[#0C1729] p-10 text-center">
          <p className="text-sm text-slate-300">No departments match "{search}".</p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setBuildingFilter('All');
            }}
            className="mt-3 rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((dept) => (
            <article
              key={dept.id}
              className="flex flex-col justify-between rounded-xl border border-slate-800/90 bg-[#0C1729] p-5 hover:border-sky-700/60 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                  <span className="font-mono text-sky-400">{dept.code}</span>
                  <span>
                    {dept.building} · {dept.floor} · {dept.roomNumber}
                  </span>
                </div>
                <h3 className="mt-2 text-base font-semibold text-white">{dept.name}</h3>
                <p className="mt-1.5 text-sm text-slate-300 leading-relaxed">{dept.description}</p>

                <div className="mt-4 border-t border-slate-800/80 pt-3 text-xs text-slate-300 leading-relaxed">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-3.5 w-3.5 text-sky-400 mt-0.5 shrink-0" />
                    <span>{dept.directions}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-3 text-xs text-slate-400">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-slate-500" />
                    {dept.headOfDepartment}
                  </span>
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Clock className="h-3.5 w-3.5 text-slate-500" />
                    {dept.officeHours}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono">
                    <Phone className="h-3.5 w-3.5 text-slate-500" />
                    {dept.contactExtension}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onAskDirections(dept.name)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600/20 border border-sky-500/30 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-600 hover:text-white transition-colors whitespace-nowrap shrink-0"
                >
                  <Compass className="h-3.5 w-3.5" />
                  <span>Guide Me</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
