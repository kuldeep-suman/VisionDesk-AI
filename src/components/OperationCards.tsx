import React from 'react';
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  Compass,
  FileSearch,
  LogOut,
  MapPin,
  MessageSquareWarning,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  AppointmentRecord,
  ComplaintRecord,
  Department,
  ExecutedOperation,
  FacultyMember,
  VisitorRecord,
} from '../types/visiondesk';

interface OperationCardsProps {
  operation: ExecutedOperation | null;
  visionAnalysis: string | null;
  onQuickCheckout?: (visitorCode: string) => void;
}

export const OperationCards: React.FC<OperationCardsProps> = ({
  operation,
  visionAnalysis,
  onQuickCheckout,
}) => {
  if (!operation && !visionAnalysis) {
    return null;
  }

  return (
    <div className="space-y-4">
      {visionAnalysis && (
        <div className="rounded-xl border border-sky-800/50 bg-[#0C1729] p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <FileSearch className="h-4 w-4 text-sky-400 shrink-0" />
              <h3 className="text-sm font-semibold text-white">Visual & Document Assessment</h3>
            </div>
            <span className="text-xs text-slate-400">Verified Visual Read</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-200 whitespace-pre-line">
            {visionAnalysis}
          </p>
        </div>
      )}

      {operation && operation.tool === 'register_visitor' && operation.status === 'success' && (
        <VisitorPassCard
          visitor={operation.data.visitor as VisitorRecord}
          department={operation.data.department as Department | null}
          onQuickCheckout={onQuickCheckout}
        />
      )}

      {operation && operation.tool === 'lookup_department' && operation.status === 'success' && (
        <DepartmentWayfindingCard department={operation.data.department as Department} />
      )}

      {operation && operation.tool === 'search_faculty' && (
        <FacultyResultCard
          facultyList={(operation.data.faculty as FacultyMember[]) || []}
        />
      )}

      {operation && operation.tool === 'request_appointment' && operation.status === 'success' && (
        <AppointmentReceiptCard
          appointment={operation.data.appointment as AppointmentRecord}
        />
      )}

      {operation && operation.tool === 'register_complaint' && operation.status === 'success' && (
        <ComplaintReceiptCard
          complaint={operation.data.complaint as ComplaintRecord}
        />
      )}

      {operation && operation.tool === 'checkout_visitor' && operation.status === 'success' && (
        <CheckoutReceiptCard
          visitor={operation.data.visitor as VisitorRecord}
          alreadyCheckedOut={Boolean(operation.data.alreadyCheckedOut)}
        />
      )}
    </div>
  );
};

const VisitorPassCard: React.FC<{
  visitor: VisitorRecord;
  department: Department | null;
  onQuickCheckout?: (code: string) => void;
}> = ({ visitor, department, onQuickCheckout }) => {
  return (
    <div className="rounded-xl border border-sky-700/50 bg-[#0C1729] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <UserCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          <h3 className="text-sm font-semibold text-white">Digital Visitor Pass Issued</h3>
        </div>
        <span className="font-mono text-xs font-semibold text-sky-300 tabular-nums">
          {visitor.visitorCode}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
        <div>
          <div className="text-xs text-slate-400">Visitor Name</div>
          <div className="font-medium text-white mt-0.5">{visitor.fullName}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Mobile Number</div>
          <div className="font-mono text-slate-200 mt-0.5 tabular-nums">{visitor.mobileNumber}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Destination Department</div>
          <div className="text-slate-100 mt-0.5">{visitor.departmentName}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Check-In Time</div>
          <div className="font-mono text-slate-200 mt-0.5 tabular-nums">
            {new Date(visitor.checkInTime).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      </div>

      {department && (
        <div className="mt-4 border-t border-slate-800/80 pt-3 text-xs leading-relaxed text-slate-300">
          <span className="font-semibold text-sky-300">
            {department.building} · {department.floor} · {department.roomNumber}:
          </span>{' '}
          {department.directions}
        </div>
      )}

      {onQuickCheckout && visitor.status === 'checked_in' && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => onQuickCheckout(visitor.visitorCode)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-sky-500/50 hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Check Out Now</span>
          </button>
        </div>
      )}
    </div>
  );
};

const DepartmentWayfindingCard: React.FC<{ department: Department }> = ({ department }) => {
  return (
    <div className="rounded-xl border border-sky-800/50 bg-[#0C1729] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-sky-400">
            <Compass className="h-3.5 w-3.5 shrink-0" />
            <span>Campus Wayfinding</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{department.code}</span>
          </div>
          <h3 className="mt-1 text-base font-semibold text-white">{department.name}</h3>
        </div>
        <span className="text-xs text-slate-400 tabular-nums">{department.officeHours}</span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-5">
        <div className="md:col-span-3 space-y-3 text-sm">
          <div className="flex items-start gap-2 text-slate-200">
            <MapPin className="h-4 w-4 text-sky-400 mt-0.5 shrink-0" />
            <span>
              {department.building} · {department.floor} · {department.roomNumber}
            </span>
          </div>
          <p className="text-slate-300 leading-relaxed">{department.directions}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 pt-1">
            <span>Head: {department.headOfDepartment}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{department.contactExtension}</span>
          </div>
        </div>
        <div className="md:col-span-2 overflow-hidden rounded-lg border border-slate-800 bg-[#071121]">
          <img
            src="/src/assets/images/campus_wayfinding_preview_1794839191202.jpg"
            alt={`Wayfinding map for ${department.name}`}
            referrerPolicy="no-referrer"
            className="h-32 w-full object-cover"
          />
        </div>
      </div>
    </div>
  );
};

const FacultyResultCard: React.FC<{ facultyList: FacultyMember[] }> = ({ facultyList }) => {
  if (!facultyList.length) {
    return (
      <div className="rounded-xl border border-slate-800 bg-[#0C1729] p-5 text-sm text-slate-300">
        No matching faculty record was found in the directory. Reception staff can verify availability by extension.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-sky-800/50 bg-[#0C1729] p-5">
      <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-sky-400 shrink-0" />
          <h3 className="text-sm font-semibold text-white">Faculty Directory Match</h3>
        </div>
        <span className="text-xs text-slate-400 tabular-nums">
          {facultyList.length} found
        </span>
      </div>
      <div className="mt-3 divide-y divide-slate-800/70">
        {facultyList.slice(0, 4).map((f) => (
          <div key={f.id} className="py-3 first:pt-1 last:pb-0 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-white">{f.name}</div>
              <div className="text-xs text-slate-400 mt-0.5">
                {f.designation} · {f.departmentName}
              </div>
              <div className="text-xs text-slate-300 mt-1">
                Cabin {f.cabinNumber} · {f.availabilityHours}
              </div>
            </div>
            <div className="text-xs font-medium">
              {f.isAvailable ? (
                <span className="text-emerald-400">Available</span>
              ) : (
                <span className="text-amber-400">In Meeting</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AppointmentReceiptCard: React.FC<{ appointment: AppointmentRecord }> = ({
  appointment,
}) => {
  return (
    <div className="rounded-xl border border-sky-800/50 bg-[#0C1729] p-5">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-amber-400 shrink-0" />
          <h3 className="text-sm font-semibold text-white">Appointment Request Submitted</h3>
        </div>
        <span className="font-mono text-xs text-sky-300 tabular-nums">
          {appointment.appointmentCode}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 text-sm">
        <div>
          <div className="text-xs text-slate-400">Faculty Requested</div>
          <div className="text-white font-medium mt-0.5">{appointment.facultyName}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Status</div>
          <div className="text-amber-300 font-medium mt-0.5">Pending Admin Approval</div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Requested Schedule</div>
          <div className="font-mono text-slate-200 mt-0.5 tabular-nums">
            {appointment.preferredDate} · {appointment.preferredTime}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Department</div>
          <div className="text-slate-200 mt-0.5">{appointment.departmentName}</div>
        </div>
      </div>
    </div>
  );
};

const ComplaintReceiptCard: React.FC<{ complaint: ComplaintRecord }> = ({ complaint }) => {
  return (
    <div className="rounded-xl border border-sky-800/50 bg-[#0C1729] p-5">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <MessageSquareWarning className="h-4 w-4 text-sky-400 shrink-0" />
          <h3 className="text-sm font-semibold text-white">Grievance Ticket Registered</h3>
        </div>
        <span className="font-mono text-xs text-sky-300 tabular-nums">
          {complaint.ticketCode}
        </span>
      </div>
      <p className="mt-3 text-sm text-slate-200">{complaint.description}</p>
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
        <span>Category: {complaint.category}</span>
        <span aria-hidden="true">·</span>
        <span>Status: Open for Review</span>
      </div>
    </div>
  );
};

const CheckoutReceiptCard: React.FC<{
  visitor: VisitorRecord;
  alreadyCheckedOut: boolean;
}> = ({ visitor, alreadyCheckedOut }) => {
  return (
    <div className="rounded-xl border border-emerald-800/40 bg-[#0C1729] p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <h3 className="text-sm font-semibold text-white">
            {alreadyCheckedOut ? 'Visitor Already Checked Out' : 'Visitor Check-Out Confirmed'}
          </h3>
        </div>
        <span className="font-mono text-xs text-slate-300 tabular-nums">
          {visitor.visitorCode}
        </span>
      </div>
      <div className="mt-2 text-xs text-slate-300">
        {visitor.fullName} · {visitor.departmentName}
        {visitor.checkOutTime &&
          ` · Checked out at ${new Date(visitor.checkOutTime).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}`}
      </div>
    </div>
  );
};
