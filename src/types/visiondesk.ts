export interface Department {
  id: number;
  code: string;
  name: string;
  building: string;
  floor: string;
  roomNumber: string;
  directions: string;
  officeHours: string;
  contactExtension: string;
  headOfDepartment: string;
  description: string;
}

export interface FacultyMember {
  id: number;
  name: string;
  designation: string;
  departmentId: number;
  departmentName: string;
  departmentCode: string;
  building: string;
  floor: string;
  cabinNumber: string;
  availabilityHours: string;
  email: string;
  specialization: string;
  isAvailable: boolean;
}

export interface VisitorRecord {
  id: number;
  visitorCode: string;
  fullName: string;
  mobileNumber: string;
  purpose: string;
  departmentId: number | null;
  departmentName: string;
  hostFacultyName: string | null;
  status: 'checked_in' | 'checked_out';
  checkInTime: string;
  checkOutTime: string | null;
  language: string | null;
  notes: string | null;
}

export interface AppointmentRecord {
  id: number;
  appointmentCode: string;
  visitorName: string;
  visitorMobile: string;
  facultyId: number | null;
  facultyName: string;
  departmentName: string;
  purpose: string;
  preferredDate: string;
  preferredTime: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  adminNotes: string | null;
  createdAt: string;
}

export interface ComplaintRecord {
  id: number;
  ticketCode: string;
  complainantName: string;
  mobileNumber: string;
  category: string;
  departmentName: string | null;
  description: string;
  status: 'open' | 'in_review' | 'resolved';
  resolutionNotes: string | null;
  createdAt: string;
}

export interface ActivityRecord {
  id: number;
  eventType: string;
  actorName: string;
  referenceCode: string | null;
  summary: string;
  createdAt: string;
}

export interface ExecutedOperation {
  tool: string;
  status: 'success' | 'not_found' | 'error';
  data: Record<string, unknown>;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  source: 'voice' | 'text' | 'vision';
  timestamp: string;
}

export interface AdminOverview {
  admin: {
    uid: string;
    email: string;
    name: string;
  };
  summary: {
    totalVisitors: number;
    activeVisitors: number;
    checkedOutVisitors: number;
    pendingAppointments: number;
    totalAppointments: number;
    openComplaints: number;
    totalComplaints: number;
  };
  departmentBreakdown: Array<{ departmentName: string; count: number }>;
  languageBreakdown: Array<{ language: string; count: number }>;
  recentActivity: ActivityRecord[];
}

export type AppView = 'reception' | 'departments' | 'faculty' | 'admin';
