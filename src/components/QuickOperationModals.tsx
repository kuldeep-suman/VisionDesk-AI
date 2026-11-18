import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Department, ExecutedOperation, FacultyMember } from '../types/visiondesk';

export type QuickModalType =
  | 'register'
  | 'appointment'
  | 'complaint'
  | 'checkout'
  | null;

interface QuickOperationModalsProps {
  modalType: QuickModalType;
  departments: Department[];
  facultyList: FacultyMember[];
  initialFacultyName?: string;
  onClose: () => void;
  onOperationSuccess: (op: ExecutedOperation, assistantSummary: string) => void;
}

export const QuickOperationModals: React.FC<QuickOperationModalsProps> = ({
  modalType,
  departments,
  facultyList,
  initialFacultyName,
  onClose,
  onOperationSuccess,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Visitor Registration State
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [purpose, setPurpose] = useState('');
  const [departmentQuery, setDepartmentQuery] = useState(
    departments[0]?.name || 'Admissions & Counseling Cell'
  );
  const [hostFacultyName, setHostFacultyName] = useState('');
  const [language, setLanguage] = useState('English');

  // Appointment State
  const [aptFaculty, setAptFaculty] = useState(
    initialFacultyName || facultyList[0]?.name || 'Dr. Neeraj Gupta'
  );
  const [aptDate, setAptDate] = useState(new Date().toISOString().slice(0, 10));
  const [aptTime, setAptTime] = useState('11:30 AM');

  // Complaint State
  const [category, setCategory] = useState('Facilities');
  const [complaintDesc, setComplaintDesc] = useState('');

  // Checkout State
  const [checkoutLookup, setCheckoutLookup] = useState('');

  if (!modalType) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (modalType === 'register') {
        const res = await fetch('/api/reception/visitors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName,
            mobileNumber,
            purpose,
            departmentQuery,
            hostFacultyName: hostFacultyName || undefined,
            language,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed.');
        onOperationSuccess(
          { tool: 'register_visitor', status: 'success', data },
          `Visitor pass ${data.visitor.visitorCode} issued for ${data.visitor.fullName}. Please proceed to ${data.visitor.departmentName}.`
        );
        onClose();
      } else if (modalType === 'appointment') {
        const matched = facultyList.find((f) => f.name === aptFaculty);
        const res = await fetch('/api/reception/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visitorName: fullName,
            visitorMobile: mobileNumber,
            facultyName: aptFaculty,
            departmentName: matched?.departmentName,
            purpose,
            preferredDate: aptDate,
            preferredTime: aptTime,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Appointment request failed.');
        onOperationSuccess(
          { tool: 'request_appointment', status: 'success', data },
          `Appointment request ${data.appointment.appointmentCode} with ${data.appointment.facultyName} has been saved for administrator approval.`
        );
        onClose();
      } else if (modalType === 'complaint') {
        const res = await fetch('/api/reception/complaints', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            complainantName: fullName,
            mobileNumber,
            category,
            departmentName: departmentQuery,
            description: complaintDesc,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Complaint submission failed.');
        onOperationSuccess(
          { tool: 'register_complaint', status: 'success', data },
          `Grievance ticket ${data.complaint.ticketCode} has been logged under ${data.complaint.category}.`
        );
        onClose();
      } else if (modalType === 'checkout') {
        const trimmed = checkoutLookup.trim();
        const isCode = trimmed.toUpperCase().startsWith('CPU-');
        const isMobile = /^\d{8,14}$/.test(trimmed);
        const res = await fetch('/api/reception/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            isCode
              ? { visitorCode: trimmed }
              : isMobile
              ? { mobileNumber: trimmed }
              : { fullName: trimmed }
          ),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Check-out lookup failed.');
        onOperationSuccess(
          { tool: 'checkout_visitor', status: 'success', data },
          `Check-out completed for ${data.visitor.fullName} (${data.visitor.visitorCode}). Thank you for visiting Career Point University.`
        );
        onClose();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to complete request.');
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    modalType === 'register'
      ? 'Visitor Check-In & Pass Registration'
      : modalType === 'appointment'
      ? 'Request Faculty Appointment'
      : modalType === 'complaint'
      ? 'Register Grievance or Support Ticket'
      : 'Visitor Check-Out';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-modal-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-[#0C1729] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 id="quick-modal-title" className="text-lg font-semibold text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-800/60 bg-red-950/40 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          )}

          {modalType === 'checkout' ? (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Visitor Pass ID, Mobile Number, or Full Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. CPU-2026-1001 or 9829011234"
                value={checkoutLookup}
                onChange={(e) => setCheckoutLookup(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#060D1A] px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
              />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter visitor name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-[#060D1A] px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="10-digit mobile number"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-[#060D1A] px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              {modalType === 'register' && (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Department to Visit
                      </label>
                      <select
                        value={departmentQuery}
                        onChange={(e) => setDepartmentQuery(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-[#060D1A] px-3 py-2.5 text-sm text-white focus:border-sky-500 focus:outline-none"
                      >
                        {departments.map((d) => (
                          <option key={d.id} value={d.name}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Preferred Language
                      </label>
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-[#060D1A] px-3 py-2.5 text-sm text-white focus:border-sky-500 focus:outline-none"
                      >
                        <option value="English">English</option>
                        <option value="Hindi">Hindi</option>
                        <option value="Hinglish">Hinglish</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Person to Meet (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Faculty or officer name"
                      value={hostFacultyName}
                      onChange={(e) => setHostFacultyName(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-[#060D1A] px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Purpose of Visit
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Admission Counseling, Marksheet Inquiry, Campus Tour"
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-[#060D1A] px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {modalType === 'appointment' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Faculty / Official
                    </label>
                    <select
                      value={aptFaculty}
                      onChange={(e) => setAptFaculty(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-[#060D1A] px-3 py-2.5 text-sm text-white focus:border-sky-500 focus:outline-none"
                    >
                      {facultyList.map((f) => (
                        <option key={f.id} value={f.name}>
                          {f.name} — {f.departmentCode} ({f.designation})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Preferred Date
                      </label>
                      <input
                        type="date"
                        required
                        value={aptDate}
                        onChange={(e) => setAptDate(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-[#060D1A] px-3 py-2.5 text-sm text-white focus:border-sky-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Preferred Time
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 11:30 AM"
                        value={aptTime}
                        onChange={(e) => setAptTime(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-[#060D1A] px-3 py-2.5 text-sm text-white focus:border-sky-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Meeting Purpose
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Brief agenda for the faculty meeting"
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-[#060D1A] px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {modalType === 'complaint' && (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Category
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-[#060D1A] px-3 py-2.5 text-sm text-white focus:border-sky-500 focus:outline-none"
                      >
                        <option value="Facilities">Facilities</option>
                        <option value="Admissions">Admissions</option>
                        <option value="Examinations">Examinations</option>
                        <option value="Accounts">Accounts</option>
                        <option value="General">General</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Department
                      </label>
                      <select
                        value={departmentQuery}
                        onChange={(e) => setDepartmentQuery(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-[#060D1A] px-3 py-2.5 text-sm text-white focus:border-sky-500 focus:outline-none"
                      >
                        {departments.map((d) => (
                          <option key={d.id} value={d.name}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Issue Description
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Describe the concern clearly so our staff can resolve it"
                      value={complaintDesc}
                      onChange={(e) => setComplaintDesc(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-[#060D1A] px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                </>
              )}
            </>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              {submitting ? 'Saving...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
