import { Content, FunctionDeclaration, GoogleGenAI, Type } from '@google/genai';
import {
  checkoutVisitor,
  createAppointment,
  createComplaint,
  listDepartments,
  listFaculty,
  logActivity,
  registerVisitor,
  resolveDepartment,
} from '../db/repository.ts';

export function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Please select an API key in Settings > Secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function getLiveAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Please select an API key in Settings > Secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      apiVersion: 'v1beta',
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export const VISIONDESK_SYSTEM_PROMPT = `Your name is VisionDesk.
You are the official virtual receptionist of Career Point University, Kota, Rajasthan, India (Campus: Alaniya, Jhalawar Road, Kota, Rajasthan 325003).

You behave like a highly professional, intelligent, friendly, and helpful human receptionist — never like a generic chatbot.

PERSONALITY:
- Professional, warm, patient, respectful, confident, naturally conversational, helpful, and efficient.
- Speak naturally with Indian hospitality and clarity (appropriate Indian English, pure Hindi, or natural Roman Hindi / Hinglish).

LANGUAGE:
- Understand Hindi (Devanagari and spoken), English, and Roman Hindi / Hinglish seamlessly.
- Always reply in the visitor's preferred language and script/style.
- Use simple, concise, natural sentences suitable for spoken reception conversation. Avoid long monologues or bullet-heavy essays unless listing step-by-step walking directions.

BEHAVIOUR:
- Welcome visitors warmly when greeted or when a new visitor is detected on camera.
- Understand their actual requirement and ask relevant follow-up questions to complete reception procedures.
- Maintain conversation context across turns.
- For visitor registration: politely collect (1) Full Name, (2) 10-digit Mobile Number, (3) Purpose of Visit, and (4) Department or Person to meet, then call register_visitor.
- For faculty meetings / appointment requests: search the faculty directory first with search_faculty, then collect visitor name, mobile, purpose, preferred date & time, and call request_appointment (noting clearly that the request is saved as Pending for admin/faculty approval — never claim it is pre-approved).
- For directions / department help: call lookup_department to retrieve verified building, floor, room number, office hours, and walking directions.
- For visitor check-out: ask for their Visitor ID (e.g., CPU-2026-xxxx), mobile number, or full name, and call checkout_visitor.
- For complaints or grievances: collect name, mobile, category, and issue details, then call register_complaint.

CAMERA & VISION:
- Observe the live camera only when enabled by the visitor.
- Describe ONLY what is genuinely visible and verifiable in the camera frame or uploaded document.
- Never invent or guess visual details, text, or numbers that are not clearly visible.
- Never identify people by facial recognition or guess a visitor's name/identity from their face.

OPERATIONS & ACCURACY:
- Always use backend functions for visitor registration, department lookup, faculty search, appointment requests, complaints, and check-out.
- NEVER claim an operation succeeded until the backend function confirms success and returns the verified record/code.
- Never invent university information, fees, faculty names, room numbers, or office timings. Use verified database data or get_university_info. If specific data is unavailable, honestly explain that the reception staff at the main desk will assist.

VERIFIED UNIVERSITY BASELINE (Career Point University, Kota):
- Address: Alaniya, Jhalawar Road, Kota, Rajasthan 325003.
- Standard Campus Reception & Office Timings: Monday to Saturday, 9:00 AM – 5:00 PM (Closed Sundays & gazetted holidays).
- Central Library Hours: Monday to Saturday, 8:30 AM – 7:30 PM.
- Accounts & Fee Counter: Monday to Saturday, 9:30 AM – 4:00 PM.
- Examination Cell: Monday to Saturday, 9:30 AM – 4:30 PM.`;

export const receptionFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: 'register_visitor',
    description:
      'Registers a visitor in the Career Point University reception PostgreSQL database, generates a unique Visitor ID (e.g. CPU-2026-XXXX), logs check-in time, and returns verified department directions.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        fullName: {
          type: Type.STRING,
          description: 'Full name of the visitor.',
        },
        mobileNumber: {
          type: Type.STRING,
          description: 'Visitor mobile phone number.',
        },
        purpose: {
          type: Type.STRING,
          description: 'Purpose of the campus visit.',
        },
        departmentQuery: {
          type: Type.STRING,
          description: 'Department name or code the visitor intends to visit (e.g., Admissions, CSE, Examination Cell, Accounts).',
        },
        hostFacultyName: {
          type: Type.STRING,
          description: 'Optional faculty or staff member name the visitor is meeting.',
        },
        language: {
          type: Type.STRING,
          description: 'Preferred language: English, Hindi, or Hinglish.',
        },
      },
      required: ['fullName', 'mobileNumber', 'purpose', 'departmentQuery'],
    },
  },
  {
    name: 'checkout_visitor',
    description:
      'Checks out an active visitor from the campus database using their Visitor ID, mobile number, or full name.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        visitorCode: {
          type: Type.STRING,
          description: 'Unique visitor pass code such as CPU-2026-1001.',
        },
        mobileNumber: {
          type: Type.STRING,
          description: 'Visitor mobile number used during check-in.',
        },
        fullName: {
          type: Type.STRING,
          description: 'Full name of the visitor checking out.',
        },
      },
    },
  },
  {
    name: 'lookup_department',
    description:
      'Looks up verified Career Point University department details, building, floor, room number, step-by-step walking directions, office hours, and Head of Department.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'Department name, code, or topic (e.g., Admissions, CSE, Exam, Accounts, Law, Pharmacy, Agriculture, Library, Hostel).',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_faculty',
    description:
      'Searches the verified faculty directory at Career Point University, Kota by faculty name, specialization, or department.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'Faculty name, designation, or subject/department keyword. Leave empty to list all faculty.',
        },
      },
    },
  },
  {
    name: 'request_appointment',
    description:
      'Creates a real pending faculty appointment request in the database for administrator approval.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        visitorName: { type: Type.STRING, description: 'Full name of the visitor.' },
        visitorMobile: { type: Type.STRING, description: 'Mobile number of the visitor.' },
        facultyName: { type: Type.STRING, description: 'Name of the faculty member requested.' },
        departmentName: { type: Type.STRING, description: 'Department name.' },
        purpose: { type: Type.STRING, description: 'Reason for the appointment.' },
        preferredDate: { type: Type.STRING, description: 'Preferred date (YYYY-MM-DD or Today/Tomorrow).' },
        preferredTime: { type: Type.STRING, description: 'Preferred time slot (e.g., 11:30 AM).' },
      },
      required: [
        'visitorName',
        'visitorMobile',
        'facultyName',
        'purpose',
        'preferredDate',
        'preferredTime',
      ],
    },
  },
  {
    name: 'register_complaint',
    description:
      'Registers an official grievance or service complaint in the university database and issues a ticket code.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        complainantName: { type: Type.STRING, description: 'Name of the person filing the complaint.' },
        mobileNumber: { type: Type.STRING, description: 'Contact mobile number.' },
        category: {
          type: Type.STRING,
          description: 'Category: Facilities, Admissions, Examinations, Accounts, or General.',
        },
        departmentName: {
          type: Type.STRING,
          description: 'Related department if applicable.',
        },
        description: { type: Type.STRING, description: 'Clear description of the issue.' },
      },
      required: ['complainantName', 'mobileNumber', 'category', 'description'],
    },
  },
  {
    name: 'get_university_info',
    description:
      'Retrieves verified Career Point University, Kota institutional information on timings, admissions, examinations, accounts, campus facilities, or hostel.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        topic: {
          type: Type.STRING,
          description: 'Topic: timings, admissions, examinations, accounts, campus, or hostel.',
        },
      },
      required: ['topic'],
    },
  },
];

export interface ExecutedOperation {
  [key: string]: unknown;
  tool: string;
  status: 'success' | 'not_found' | 'error';
  data: unknown;
}

export async function executeReceptionTool(
  name: string,
  rawArgs: Record<string, unknown> = {}
): Promise<ExecutedOperation> {
  try {
    switch (name) {
      case 'register_visitor': {
        const result = await registerVisitor({
          fullName: String(rawArgs.fullName || ''),
          mobileNumber: String(rawArgs.mobileNumber || ''),
          purpose: String(rawArgs.purpose || ''),
          departmentQuery: String(rawArgs.departmentQuery || 'Admissions'),
          hostFacultyName: rawArgs.hostFacultyName ? String(rawArgs.hostFacultyName) : undefined,
          language: rawArgs.language ? String(rawArgs.language) : 'English',
        });
        return {
          tool: 'register_visitor',
          status: 'success',
          data: result,
        };
      }

      case 'checkout_visitor': {
        const result = await checkoutVisitor({
          visitorCode: rawArgs.visitorCode ? String(rawArgs.visitorCode) : undefined,
          mobileNumber: rawArgs.mobileNumber ? String(rawArgs.mobileNumber) : undefined,
          fullName: rawArgs.fullName ? String(rawArgs.fullName) : undefined,
        });
        if (!result) {
          return {
            tool: 'checkout_visitor',
            status: 'not_found',
            data: { message: 'No matching visitor check-in record found.' },
          };
        }
        return {
          tool: 'checkout_visitor',
          status: 'success',
          data: result,
        };
      }

      case 'lookup_department': {
        const query = String(rawArgs.query || '');
        const resolved = await resolveDepartment(query);
        const matches = resolved ? [resolved] : await listDepartments(query);
        if (!matches.length) {
          const all = await listDepartments();
          return {
            tool: 'lookup_department',
            status: 'not_found',
            data: {
              message: `No exact department matched "${query}". Available departments listed.`,
              availableDepartments: all.map((d) => ({
                code: d.code,
                name: d.name,
                building: d.building,
                floor: d.floor,
                roomNumber: d.roomNumber,
              })),
            },
          };
        }
        await logActivity({
          eventType: 'department_lookup',
          actorName: 'Reception Visitor',
          referenceCode: matches[0].code,
          summary: `Retrieved directions for ${matches[0].name} (${matches[0].building}, ${matches[0].roomNumber})`,
        });
        return {
          tool: 'lookup_department',
          status: 'success',
          data: { department: matches[0], allMatches: matches },
        };
      }

      case 'search_faculty': {
        const query = rawArgs.query ? String(rawArgs.query) : '';
        const results = await listFaculty(query);
        return {
          tool: 'search_faculty',
          status: results.length ? 'success' : 'not_found',
          data: { faculty: results },
        };
      }

      case 'request_appointment': {
        const result = await createAppointment({
          visitorName: String(rawArgs.visitorName || ''),
          visitorMobile: String(rawArgs.visitorMobile || ''),
          facultyName: String(rawArgs.facultyName || ''),
          departmentName: rawArgs.departmentName ? String(rawArgs.departmentName) : undefined,
          purpose: String(rawArgs.purpose || ''),
          preferredDate: String(rawArgs.preferredDate || new Date().toISOString().slice(0, 10)),
          preferredTime: String(rawArgs.preferredTime || '11:00 AM'),
        });
        return {
          tool: 'request_appointment',
          status: 'success',
          data: result,
        };
      }

      case 'register_complaint': {
        const ticket = await createComplaint({
          complainantName: String(rawArgs.complainantName || ''),
          mobileNumber: String(rawArgs.mobileNumber || ''),
          category: String(rawArgs.category || 'General'),
          departmentName: rawArgs.departmentName ? String(rawArgs.departmentName) : undefined,
          description: String(rawArgs.description || ''),
        });
        return {
          tool: 'register_complaint',
          status: 'success',
          data: { complaint: ticket },
        };
      }

      case 'get_university_info': {
        const topic = String(rawArgs.topic || 'campus').toLowerCase();
        const allDepts = await listDepartments();
        const info: Record<string, unknown> = {
          institution: 'Career Point University, Kota',
          address: 'Alaniya, Jhalawar Road, Kota, Rajasthan 325003, India',
          officeTimings: 'Monday to Saturday, 9:00 AM – 5:00 PM (Closed Sundays & public holidays)',
          libraryTimings: 'Monday to Saturday, 8:30 AM – 7:30 PM',
          accountsTimings: 'Monday to Saturday, 9:30 AM – 4:00 PM',
          examCellTimings: 'Monday to Saturday, 9:30 AM – 4:30 PM',
          topic,
          relatedDepartments: allDepts.filter(
            (d) =>
              d.name.toLowerCase().includes(topic) ||
              d.description.toLowerCase().includes(topic) ||
              d.code.toLowerCase().includes(topic)
          ),
        };
        return {
          tool: 'get_university_info',
          status: 'success',
          data: info,
        };
      }

      default:
        return {
          tool: name,
          status: 'error',
          data: { message: `Unknown operation: ${name}` },
        };
    }
  } catch (error) {
    console.error(`Tool execution failed (${name}):`, error);
    return {
      tool: name,
      status: 'error',
      data: {
        message: error instanceof Error ? error.message : 'Backend operation failed.',
      },
    };
  }
}

export async function runLowLatencyReceptionTextChat(input: {
  message: string;
  history?: Array<{ role: 'user' | 'model'; text: string }>;
  imageBase64?: string;
  imageMimeType?: string;
}) {
  const contents: Content[] = (input.history || []).slice(-12).map((item) => ({
    role: item.role,
    parts: [{ text: item.text }],
  }));

  const userParts: Content['parts'] = [];
  if (input.imageBase64) {
    userParts.push({
      inlineData: {
        mimeType: input.imageMimeType || 'image/jpeg',
        data: input.imageBase64,
      },
    });
  }
  userParts.push({ text: input.message });
  contents.push({ role: 'user', parts: userParts });

  const operations: ExecutedOperation[] = [];
  let iterations = 0;

  const aiClient = getAiClient();
  while (iterations < 4) {
    iterations += 1;
    const response = await aiClient.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents,
      config: {
        systemInstruction: VISIONDESK_SYSTEM_PROMPT,
        tools: [{ functionDeclarations: receptionFunctionDeclarations }],
      },
    });

    const candidateContent = response.candidates?.[0]?.content;
    const calls = response.functionCalls;

    if (calls && calls.length > 0 && candidateContent) {
      contents.push(candidateContent);
      const responseParts = [];
      for (const call of calls) {
        const result = await executeReceptionTool(
          call.name || '',
          (call.args as Record<string, unknown>) || {}
        );
        operations.push(result);
        responseParts.push({
          functionResponse: {
            id: call.id,
            name: call.name,
            response: result,
          },
        });
      }
      contents.push({ role: 'user', parts: responseParts });
      continue;
    }

    return {
      reply:
        response.text?.trim() ||
        'I apologize, could you please repeat that? I am ready to assist you at Career Point University reception.',
      operations,
    };
  }

  return {
    reply: 'Your request has been processed. Please let me know how else I may assist you.',
    operations,
  };
}

export async function analyzeImageOrDocument(input: {
  imageBase64: string;
  mimeType: string;
  prompt?: string;
  source?: 'camera' | 'upload';
}) {
  const analysisPrompt =
    input.prompt?.trim() ||
    `Observe this ${input.source === 'camera' ? 'live reception camera frame' : 'uploaded document or photo'} carefully.
1. Describe ONLY what is clearly and genuinely visible. Never invent or guess unreadable text or unseen details.
2. Do NOT identify any person using facial recognition or guess anyone's identity.
3. If this is a university document (such as an admission form, fee challan, ID card, marksheet, or notice), summarize its visible details and advise which Career Point University department (Admissions, Examination Cell, Accounts, etc.) can assist.`;

  const aiClient = getAiClient();
  const imageContents = {
    parts: [
      {
        inlineData: {
          mimeType: input.mimeType || 'image/jpeg',
          data: input.imageBase64,
        },
      },
      { text: analysisPrompt },
    ],
  };

  let response;
  try {
    response = await aiClient.models.generateContent({
      model: 'gemini-4-argon',
      contents: imageContents,
      config: {
        systemInstruction: VISIONDESK_SYSTEM_PROMPT,
      },
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (
      errMsg.includes('429') ||
      errMsg.includes('403') ||
      errMsg.includes('RESOURCE_EXHAUSTED') ||
      errMsg.includes('PERMISSION_DENIED') ||
      errMsg.includes('quota')
    ) {
      response = await aiClient.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: imageContents,
        config: {
          systemInstruction: VISIONDESK_SYSTEM_PROMPT,
        },
      });
    } else {
      throw err;
    }
  }

  await logActivity({
    eventType: 'document_analyzed',
    actorName: input.source === 'camera' ? 'Live Camera Vision' : 'Uploaded Document',
    summary: `Analyzed ${input.source === 'camera' ? 'live camera capture' : 'uploaded photo/document'} with VisionDesk visual intelligence`,
  });

  return {
    analysis:
      response.text?.trim() ||
      'No clear details could be extracted from this image. Please hold the document steady or upload a clearer photo.',
  };
}
