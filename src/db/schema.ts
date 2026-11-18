import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  name: text('name'),
  // role: text('role').notNull().default('admin'),
  role: text('role').notNull().default('visitor'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const departments = pgTable('departments', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  building: text('building').notNull(),
  floor: text('floor').notNull(),
  roomNumber: text('room_number').notNull(),
  directions: text('directions').notNull(),
  officeHours: text('office_hours').notNull(),
  contactExtension: text('contact_extension').notNull(),
  headOfDepartment: text('head_of_department').notNull(),
  description: text('description').notNull(),
});

export const faculty = pgTable('faculty', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  designation: text('designation').notNull(),
  departmentId: integer('department_id')
    .references(() => departments.id)
    .notNull(),
  cabinNumber: text('cabin_number').notNull(),
  availabilityHours: text('availability_hours').notNull(),
  email: text('email').notNull(),
  specialization: text('specialization').notNull(),
  isAvailable: boolean('is_available').notNull().default(true),
});

export const visitors = pgTable('visitors', {
  id: serial('id').primaryKey(),
  visitorCode: text('visitor_code').notNull().unique(),
  fullName: text('full_name').notNull(),
  mobileNumber: text('mobile_number').notNull(),
  purpose: text('purpose').notNull(),
  departmentId: integer('department_id').references(() => departments.id),
  departmentName: text('department_name').notNull(),
  hostFacultyName: text('host_faculty_name'),
  status: text('status').notNull().default('checked_in'),
  checkInTime: timestamp('check_in_time').defaultNow().notNull(),
  checkOutTime: timestamp('check_out_time'),
  language: text('language').default('English'),
  notes: text('notes'),
});

export const appointments = pgTable('appointments', {
  id: serial('id').primaryKey(),
  appointmentCode: text('appointment_code').notNull().unique(),
  visitorName: text('visitor_name').notNull(),
  visitorMobile: text('visitor_mobile').notNull(),
  facultyId: integer('faculty_id').references(() => faculty.id),
  facultyName: text('faculty_name').notNull(),
  departmentName: text('department_name').notNull(),
  purpose: text('purpose').notNull(),
  preferredDate: text('preferred_date').notNull(),
  preferredTime: text('preferred_time').notNull(),
  status: text('status').notNull().default('pending'),
  adminNotes: text('admin_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const complaints = pgTable('complaints', {
  id: serial('id').primaryKey(),
  ticketCode: text('ticket_code').notNull().unique(),
  complainantName: text('complainant_name').notNull(),
  mobileNumber: text('mobile_number').notNull(),
  category: text('category').notNull(),
  departmentName: text('department_name'),
  description: text('description').notNull(),
  status: text('status').notNull().default('open'),
  resolutionNotes: text('resolution_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const visitorActivity = pgTable('visitor_activity', {
  id: serial('id').primaryKey(),
  eventType: text('event_type').notNull(),
  actorName: text('actor_name').notNull(),
  referenceCode: text('reference_code'),
  summary: text('summary').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const departmentsRelations = relations(departments, ({ many }) => ({
  facultyMembers: many(faculty),
  visitors: many(visitors),
}));

export const facultyRelations = relations(faculty, ({ one, many }) => ({
  department: one(departments, {
    fields: [faculty.departmentId],
    references: [departments.id],
  }),
  appointments: many(appointments),
}));

export const visitorsRelations = relations(visitors, ({ one }) => ({
  department: one(departments, {
    fields: [visitors.departmentId],
    references: [departments.id],
  }),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  faculty: one(faculty, {
    fields: [appointments.facultyId],
    references: [faculty.id],
  }),
}));
