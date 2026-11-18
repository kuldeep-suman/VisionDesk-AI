import { desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  appointments,
  complaints,
  departments,
  faculty,
  users,
  visitorActivity,
  visitors,
} from './schema.ts';

function generateCode(prefix: string): string {
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-2026-${randomDigits}`;
}

// export async function getOrCreateUser(uid: string, email: string, name?: string) {
//   try {
//     const result = await db
//       .insert(users)
//       .values({
//         uid,
//         email,
//         name: name || email.split('@')[0],
//         role: 'admin',
//       })
//       .onConflictDoUpdate({
//         target: users.uid,
//         set: {
//           email,
//           ...(name ? { name } : {}),
//         },
//       })
//       .returning();
//     return result[0];
//   } catch (error) {
//     console.error('Database error in getOrCreateUser:', error);
//     throw new Error('Failed to synchronize user account.', { cause: error });
//   }
// }
export async function getOrCreateUser(uid: string, email: string, name?: string) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        name: name || email.split('@')[0],
        role: 'visitor',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          ...(name ? { name } : {}),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database error in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

export async function listDepartments(query?: string) {
  try {
    const trimmed = query?.trim();
    if (!trimmed) {
      return await db.select().from(departments).orderBy(departments.id);
    }
    const pattern = `%${trimmed}%`;
    return await db
      .select()
      .from(departments)
      .where(
        or(
          ilike(departments.name, pattern),
          ilike(departments.code, pattern),
          ilike(departments.description, pattern),
          ilike(departments.building, pattern)
        )
      )
      .orderBy(departments.id);
  } catch (error) {
    console.error('Database error in listDepartments:', error);
    throw new Error('Unable to retrieve department records.', { cause: error });
  }
}

export async function resolveDepartment(query: string) {
  try {
    const clean = query.trim();
    if (!clean) return null;
    const allDepts = await db.select().from(departments);
    const lower = clean.toLowerCase();

    const exact = allDepts.find(
      (d) =>
        d.code.toLowerCase() === lower ||
        d.name.toLowerCase() === lower ||
        d.name.toLowerCase().includes(lower)
    );
    if (exact) return exact;

    const keywordMap: Array<[string[], string]> = [
      [['admission', 'apply', 'counseling', 'prospectus', 'btech', 'scholarship', 'tour'], 'ADM'],
      [['exam', 'marksheet', 'degree', 'admit card', 'result', 'revaluation', 'coe'], 'EXAM'],
      [['fee', 'account', 'payment', 'receipt', 'challan', 'loan', 'finance', 'no dues'], 'ACCTS'],
      [['cse', 'computer', 'engineering', 'software', 'ai', 'mca', 'bca', 'b.tech'], 'CSE'],
      [['mba', 'bba', 'management', 'commerce', 'b.com', 'business'], 'MGMT'],
      [['law', 'legal', 'llb', 'moot', 'advocate'], 'LAW'],
      [['pharm', 'pharmacy', 'medical', 'health', 'd.pharm', 'b.pharm'], 'PHARM'],
      [['agri', 'agriculture', 'farm', 'botany', 'soil'], 'AGRI'],
      [['library', 'book', 'journal', 'reading'], 'LIB'],
      [['hostel', 'mess', 'bus', 'transport', 'id card', 'welfare'], 'HOSTEL'],
    ];

    for (const [keywords, code] of keywordMap) {
      if (keywords.some((kw) => lower.includes(kw))) {
        return allDepts.find((d) => d.code === code) ?? null;
      }
    }

    return null;
  } catch (error) {
    console.error('Database error in resolveDepartment:', error);
    throw new Error('Unable to resolve department information.', { cause: error });
  }
}

export async function listFaculty(query?: string, departmentId?: number) {
  try {
    const rows = await db
      .select({
        id: faculty.id,
        name: faculty.name,
        designation: faculty.designation,
        departmentId: faculty.departmentId,
        departmentName: departments.name,
        departmentCode: departments.code,
        building: departments.building,
        floor: departments.floor,
        cabinNumber: faculty.cabinNumber,
        availabilityHours: faculty.availabilityHours,
        email: faculty.email,
        specialization: faculty.specialization,
        isAvailable: faculty.isAvailable,
      })
      .from(faculty)
      .innerJoin(departments, eq(faculty.departmentId, departments.id))
      .orderBy(faculty.id);

    return rows.filter((row) => {
      if (departmentId && row.departmentId !== departmentId) return false;
      if (query?.trim()) {
        const q = query.trim().toLowerCase();
        return (
          row.name.toLowerCase().includes(q) ||
          row.designation.toLowerCase().includes(q) ||
          row.departmentName.toLowerCase().includes(q) ||
          row.specialization.toLowerCase().includes(q)
        );
      }
      return true;
    });
  } catch (error) {
    console.error('Database error in listFaculty:', error);
    throw new Error('Unable to retrieve faculty directory.', { cause: error });
  }
}

export async function registerVisitor(input: {
  fullName: string;
  mobileNumber: string;
  purpose: string;
  departmentQuery: string;
  hostFacultyName?: string;
  language?: string;
  notes?: string;
}) {
  try {
    const dept = await resolveDepartment(input.departmentQuery);
    const visitorCode = generateCode('CPU');

    const inserted = await db
      .insert(visitors)
      .values({
        visitorCode,
        fullName: input.fullName.trim(),
        mobileNumber: input.mobileNumber.trim(),
        purpose: input.purpose.trim(),
        departmentId: dept?.id ?? null,
        departmentName: dept?.name ?? input.departmentQuery.trim(),
        hostFacultyName: input.hostFacultyName?.trim() || null,
        status: 'checked_in',
        language: input.language || 'English',
        notes: input.notes || null,
      })
      .returning();

    const record = inserted[0];

    await db.insert(visitorActivity).values({
      eventType: 'visitor_checkin',
      actorName: record.fullName,
      referenceCode: record.visitorCode,
      summary: `Checked in for ${record.purpose} · ${record.departmentName}`,
    });

    return {
      visitor: record,
      department: dept,
    };
  } catch (error) {
    console.error('Database error in registerVisitor:', error);
    throw new Error('Failed to save visitor registration.', { cause: error });
  }
}

export async function checkoutVisitor(input: {
  visitorId?: number;
  visitorCode?: string;
  mobileNumber?: string;
  fullName?: string;
}) {
  try {
    let target;
    if (input.visitorId) {
      const rows = await db
        .select()
        .from(visitors)
        .where(eq(visitors.id, input.visitorId));
      target = rows[0];
    } else if (input.visitorCode) {
      const rows = await db
        .select()
        .from(visitors)
        .where(ilike(visitors.visitorCode, input.visitorCode.trim()));
      target = rows[0];
    } else if (input.mobileNumber) {
      const rows = await db
        .select()
        .from(visitors)
        .where(eq(visitors.mobileNumber, input.mobileNumber.trim()))
        .orderBy(desc(visitors.checkInTime));
      target = rows.find((r) => r.status === 'checked_in') ?? rows[0];
    } else if (input.fullName) {
      const rows = await db
        .select()
        .from(visitors)
        .where(ilike(visitors.fullName, `%${input.fullName.trim()}%`))
        .orderBy(desc(visitors.checkInTime));
      target = rows.find((r) => r.status === 'checked_in') ?? rows[0];
    }

    if (!target) {
      return null;
    }

    if (target.status === 'checked_out') {
      return { alreadyCheckedOut: true, visitor: target };
    }

    const updated = await db
      .update(visitors)
      .set({
        status: 'checked_out',
        checkOutTime: new Date(),
      })
      .where(eq(visitors.id, target.id))
      .returning();

    const record = updated[0];

    await db.insert(visitorActivity).values({
      eventType: 'visitor_checkout',
      actorName: record.fullName,
      referenceCode: record.visitorCode,
      summary: `Checked out from ${record.departmentName}`,
    });

    return { alreadyCheckedOut: false, visitor: record };
  } catch (error) {
    console.error('Database error in checkoutVisitor:', error);
    throw new Error('Failed to process visitor check-out.', { cause: error });
  }
}

export async function createAppointment(input: {
  visitorName: string;
  visitorMobile: string;
  facultyName: string;
  departmentName?: string;
  purpose: string;
  preferredDate: string;
  preferredTime: string;
}) {
  try {
    const allFaculty = await listFaculty(input.facultyName);
    const matchedFaculty = allFaculty[0] ?? null;
    const dept =
      matchedFaculty?.departmentName ||
      (input.departmentName ? (await resolveDepartment(input.departmentName))?.name : null) ||
      input.departmentName ||
      'General Administration';

    const appointmentCode = generateCode('APT');

    const inserted = await db
      .insert(appointments)
      .values({
        appointmentCode,
        visitorName: input.visitorName.trim(),
        visitorMobile: input.visitorMobile.trim(),
        facultyId: matchedFaculty?.id ?? null,
        facultyName: matchedFaculty?.name ?? input.facultyName.trim(),
        departmentName: dept,
        purpose: input.purpose.trim(),
        preferredDate: input.preferredDate.trim(),
        preferredTime: input.preferredTime.trim(),
        status: 'pending',
      })
      .returning();

    const record = inserted[0];

    await db.insert(visitorActivity).values({
      eventType: 'appointment_created',
      actorName: record.visitorName,
      referenceCode: record.appointmentCode,
      summary: `Pending appointment request with ${record.facultyName} (${record.departmentName}) for ${record.preferredDate} at ${record.preferredTime}`,
    });

    return {
      appointment: record,
      faculty: matchedFaculty,
    };
  } catch (error) {
    console.error('Database error in createAppointment:', error);
    throw new Error('Failed to save appointment request.', { cause: error });
  }
}

export async function createComplaint(input: {
  complainantName: string;
  mobileNumber: string;
  category: string;
  departmentName?: string;
  description: string;
}) {
  try {
    const ticketCode = generateCode('CMP');
    const inserted = await db
      .insert(complaints)
      .values({
        ticketCode,
        complainantName: input.complainantName.trim(),
        mobileNumber: input.mobileNumber.trim(),
        category: input.category.trim(),
        departmentName: input.departmentName?.trim() || null,
        description: input.description.trim(),
        status: 'open',
      })
      .returning();

    const record = inserted[0];

    await db.insert(visitorActivity).values({
      eventType: 'complaint_filed',
      actorName: record.complainantName,
      referenceCode: record.ticketCode,
      summary: `Filed ${record.category} complaint${record.departmentName ? ` · ${record.departmentName}` : ''}`,
    });

    return record;
  } catch (error) {
    console.error('Database error in createComplaint:', error);
    throw new Error('Failed to register complaint ticket.', { cause: error });
  }
}

export async function logActivity(input: {
  eventType: string;
  actorName: string;
  referenceCode?: string;
  summary: string;
}) {
  try {
    await db.insert(visitorActivity).values({
      eventType: input.eventType,
      actorName: input.actorName,
      referenceCode: input.referenceCode ?? null,
      summary: input.summary,
    });
  } catch (error) {
    console.error('Database error in logActivity:', error);
  }
}

export async function listVisitors(statusFilter?: string) {
  try {
    if (statusFilter && (statusFilter === 'checked_in' || statusFilter === 'checked_out')) {
      return await db
        .select()
        .from(visitors)
        .where(eq(visitors.status, statusFilter))
        .orderBy(desc(visitors.checkInTime));
    }
    return await db.select().from(visitors).orderBy(desc(visitors.checkInTime));
  } catch (error) {
    console.error('Database error in listVisitors:', error);
    throw new Error('Unable to retrieve visitor records.', { cause: error });
  }
}

export async function listAppointments(statusFilter?: string) {
  try {
    if (statusFilter && ['pending', 'approved', 'rejected', 'completed'].includes(statusFilter)) {
      return await db
        .select()
        .from(appointments)
        .where(eq(appointments.status, statusFilter))
        .orderBy(desc(appointments.createdAt));
    }
    return await db.select().from(appointments).orderBy(desc(appointments.createdAt));
  } catch (error) {
    console.error('Database error in listAppointments:', error);
    throw new Error('Unable to retrieve appointment requests.', { cause: error });
  }
}

export async function updateAppointmentStatus(
  id: number,
  status: 'pending' | 'approved' | 'rejected' | 'completed',
  adminNotes?: string
) {
  try {
    const updated = await db
      .update(appointments)
      .set({
        status,
        ...(adminNotes !== undefined ? { adminNotes } : {}),
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, id))
      .returning();

    const record = updated[0];
    if (!record) return null;

    await db.insert(visitorActivity).values({
      eventType: 'appointment_updated',
      actorName: 'Admin Desk',
      referenceCode: record.appointmentCode,
      summary: `Appointment for ${record.visitorName} with ${record.facultyName} marked ${status}`,
    });

    return record;
  } catch (error) {
    console.error('Database error in updateAppointmentStatus:', error);
    throw new Error('Failed to update appointment status.', { cause: error });
  }
}

export async function listComplaints() {
  try {
    return await db.select().from(complaints).orderBy(desc(complaints.createdAt));
  } catch (error) {
    console.error('Database error in listComplaints:', error);
    throw new Error('Unable to retrieve complaints.', { cause: error });
  }
}

export async function updateComplaintStatus(
  id: number,
  status: 'open' | 'in_review' | 'resolved',
  resolutionNotes?: string
) {
  try {
    const updated = await db
      .update(complaints)
      .set({
        status,
        ...(resolutionNotes !== undefined ? { resolutionNotes } : {}),
      })
      .where(eq(complaints.id, id))
      .returning();
    return updated[0] ?? null;
  } catch (error) {
    console.error('Database error in updateComplaintStatus:', error);
    throw new Error('Failed to update complaint status.', { cause: error });
  }
}

export async function toggleFacultyAvailability(id: number, isAvailable: boolean) {
  try {
    const updated = await db
      .update(faculty)
      .set({ isAvailable })
      .where(eq(faculty.id, id))
      .returning();
    return updated[0] ?? null;
  } catch (error) {
    console.error('Database error in toggleFacultyAvailability:', error);
    throw new Error('Failed to update faculty availability.', { cause: error });
  }
}

export async function createFacultyMember(input: {
  name: string;
  designation: string;
  departmentId: number;
  cabinNumber: string;
  availabilityHours: string;
  email: string;
  specialization: string;
}) {
  try {
    const inserted = await db
      .insert(faculty)
      .values({
        name: input.name.trim(),
        designation: input.designation.trim(),
        departmentId: input.departmentId,
        cabinNumber: input.cabinNumber.trim(),
        availabilityHours: input.availabilityHours.trim(),
        email: input.email.trim(),
        specialization: input.specialization.trim(),
        isAvailable: true,
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database error in createFacultyMember:', error);
    throw new Error('Failed to add faculty member.', { cause: error });
  }
}

export async function updateDepartmentInfo(
  id: number,
  updates: {
    officeHours?: string;
    directions?: string;
    contactExtension?: string;
    headOfDepartment?: string;
  }
) {
  try {
    const updated = await db
      .update(departments)
      .set(updates)
      .where(eq(departments.id, id))
      .returning();
    return updated[0] ?? null;
  } catch (error) {
    console.error('Database error in updateDepartmentInfo:', error);
    throw new Error('Failed to update department information.', { cause: error });
  }
}

export async function getAdminAnalytics() {
  try {
    const [allVisitors, allAppointments, allComplaints, recentActivity, deptCounts] =
      await Promise.all([
        db.select().from(visitors).orderBy(desc(visitors.checkInTime)),
        db.select().from(appointments).orderBy(desc(appointments.createdAt)),
        db.select().from(complaints).orderBy(desc(complaints.createdAt)),
        db.select().from(visitorActivity).orderBy(desc(visitorActivity.createdAt)).limit(25),
        db
          .select({
            departmentName: visitors.departmentName,
            count: sql<number>`count(*)::int`,
          })
          .from(visitors)
          .groupBy(visitors.departmentName),
      ]);

    const activeVisitors = allVisitors.filter((v) => v.status === 'checked_in').length;
    const checkedOutVisitors = allVisitors.filter((v) => v.status === 'checked_out').length;
    const pendingAppointments = allAppointments.filter((a) => a.status === 'pending').length;
    const openComplaints = allComplaints.filter((c) => c.status !== 'resolved').length;

    const languageBreakdownMap: Record<string, number> = {};
    for (const v of allVisitors) {
      const lang = v.language || 'English';
      languageBreakdownMap[lang] = (languageBreakdownMap[lang] || 0) + 1;
    }

    return {
      summary: {
        totalVisitors: allVisitors.length,
        activeVisitors,
        checkedOutVisitors,
        pendingAppointments,
        totalAppointments: allAppointments.length,
        openComplaints,
        totalComplaints: allComplaints.length,
      },
      departmentBreakdown: deptCounts.sort((a, b) => b.count - a.count),
      languageBreakdown: Object.entries(languageBreakdownMap).map(([language, count]) => ({
        language,
        count,
      })),
      recentActivity,
    };
  } catch (error) {
    console.error('Database error in getAdminAnalytics:', error);
    throw new Error('Unable to compute visitor analytics.', { cause: error });
  }
}
