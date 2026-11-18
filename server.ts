import 'dotenv/config';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { WebSocket, WebSocketServer } from 'ws';
import { LiveServerMessage, Modality } from '@google/genai';
import {
  checkoutVisitor,
  createAppointment,
  createComplaint,
  createFacultyMember,
  getAdminAnalytics,
  listAppointments,
  listComplaints,
  listDepartments,
  listFaculty,
  listVisitors,
  registerVisitor,
  toggleFacultyAvailability,
  updateAppointmentStatus,
  updateComplaintStatus,
  updateDepartmentInfo,
} from './src/db/repository.ts';
import {
  analyzeImageOrDocument,
  executeReceptionTool,
  getLiveAiClient,
  receptionFunctionDeclarations,
  runLowLatencyReceptionTextChat,
  VISIONDESK_SYSTEM_PROMPT,
} from './src/lib/gemini.ts';
import { AuthRequest, requireAuth } from './src/middleware/auth.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const receptionChatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please try again after one minute.',
  },
});

const imageAnalysisLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'Too many image requests. Please try again after one minute.',
  },
});

app.use(express.json({ limit: '15mb' }));

// --- Public Reception API Routes ---

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'VisionDesk AI',
  });
});

app.get('/api/reception/departments', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const rows = await listDepartments(q);
    res.json({ departments: rows });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to load departments.';
    res.status(500).json({ error: msg });
  }
});

app.get('/api/reception/faculty', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const departmentId =
      typeof req.query.departmentId === 'string' && req.query.departmentId
        ? Number(req.query.departmentId)
        : undefined;
    const rows = await listFaculty(q, departmentId);
    res.json({ faculty: rows });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to load faculty directory.';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/reception/visitors', async (req, res) => {
  try {
    const { fullName, mobileNumber, purpose, departmentQuery, hostFacultyName, language, notes } =
      req.body || {};
    if (!fullName || !mobileNumber || !purpose || !departmentQuery) {
      return res.status(400).json({
        error: 'Full name, mobile number, purpose of visit, and department are required.',
      });
    }
    const result = await registerVisitor({
      fullName: String(fullName),
      mobileNumber: String(mobileNumber),
      purpose: String(purpose),
      departmentQuery: String(departmentQuery),
      hostFacultyName: hostFacultyName ? String(hostFacultyName) : undefined,
      language: language ? String(language) : 'English',
      notes: notes ? String(notes) : undefined,
    });
    res.status(201).json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Visitor registration failed.';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/reception/checkout', async (req, res) => {
  try {
    const { visitorCode, mobileNumber, fullName } = req.body || {};
    if (!visitorCode && !mobileNumber && !fullName) {
      return res
        .status(400)
        .json({ error: 'Provide a Visitor ID, mobile number, or full name to check out.' });
    }
    const result = await checkoutVisitor({
      visitorCode: visitorCode ? String(visitorCode) : undefined,
      mobileNumber: mobileNumber ? String(mobileNumber) : undefined,
      fullName: fullName ? String(fullName) : undefined,
    });
    if (!result) {
      return res.status(404).json({ error: 'No matching visitor check-in record found.' });
    }
    res.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Check-out failed.';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/reception/appointments', async (req, res) => {
  try {
    const {
      visitorName,
      visitorMobile,
      facultyName,
      departmentName,
      purpose,
      preferredDate,
      preferredTime,
    } = req.body || {};

    if (!visitorName || !visitorMobile || !facultyName || !purpose || !preferredDate || !preferredTime) {
      return res.status(400).json({
        error:
          'Visitor name, mobile number, faculty member, purpose, preferred date, and time are required.',
      });
    }

    const result = await createAppointment({
      visitorName: String(visitorName),
      visitorMobile: String(visitorMobile),
      facultyName: String(facultyName),
      departmentName: departmentName ? String(departmentName) : undefined,
      purpose: String(purpose),
      preferredDate: String(preferredDate),
      preferredTime: String(preferredTime),
    });
    res.status(201).json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Appointment request failed.';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/reception/complaints', async (req, res) => {
  try {
    const { complainantName, mobileNumber, category, departmentName, description } = req.body || {};
    if (!complainantName || !mobileNumber || !category || !description) {
      return res.status(400).json({
        error: 'Name, mobile number, category, and complaint description are required.',
      });
    }
    const complaint = await createComplaint({
      complainantName: String(complainantName),
      mobileNumber: String(mobileNumber),
      category: String(category),
      departmentName: departmentName ? String(departmentName) : undefined,
      description: String(description),
    });
    res.status(201).json({ complaint });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Complaint registration failed.';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/reception/chat', receptionChatLimiter, async (req, res) => {
  try {
    const { message, history, imageBase64, imageMimeType } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message text is required.' });
    }
    const result = await runLowLatencyReceptionTextChat({
      message,
      history: Array.isArray(history) ? history : [],
      imageBase64: typeof imageBase64 === 'string' ? imageBase64 : undefined,
      imageMimeType: typeof imageMimeType === 'string' ? imageMimeType : undefined,
    });
    res.json(result);
  } catch (error: unknown) {
    console.error('Reception chat error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to process reception request.';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/reception/analyze-image', imageAnalysisLimiter, async (req, res) => {
  try {
    const { imageBase64, mimeType, prompt, source } = req.body || {};
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'Image data is required for visual analysis.' });
    }
    const result = await analyzeImageOrDocument({
      imageBase64,
      mimeType: typeof mimeType === 'string' ? mimeType : 'image/jpeg',
      prompt: typeof prompt === 'string' ? prompt : undefined,
      source: source === 'camera' ? 'camera' : 'upload',
    });
    res.json(result);
  } catch (error: unknown) {
    console.error('Image analysis error:', error);
    const msg = error instanceof Error ? error.message : 'Visual analysis failed.';
    res.status(500).json({ error: msg });
  }
});

// --- Authenticated Admin API Routes ---

app.get('/api/admin/overview', requireAuth, async (req: AuthRequest, res) => {
  try {
    const analytics = await getAdminAnalytics();
    res.json({
      admin: {
        uid: req.user?.uid,
        email: req.user?.email,
        name: req.user?.name || req.user?.email,
      },
      ...analytics,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to load admin overview.';
    res.status(500).json({ error: msg });
  }
});

app.get('/api/admin/visitors', requireAuth, async (req: AuthRequest, res) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const rows = await listVisitors(status);
    res.json({ visitors: rows });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to load visitors.';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/admin/visitors', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { fullName, mobileNumber, purpose, departmentQuery, hostFacultyName, language } =
      req.body || {};
    if (!fullName || !mobileNumber || !purpose || !departmentQuery) {
      return res.status(400).json({ error: 'All required visitor fields must be provided.' });
    }
    const result = await registerVisitor({
      fullName: String(fullName),
      mobileNumber: String(mobileNumber),
      purpose: String(purpose),
      departmentQuery: String(departmentQuery),
      hostFacultyName: hostFacultyName ? String(hostFacultyName) : undefined,
      language: language ? String(language) : 'English',
    });
    res.status(201).json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to check in visitor.';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/admin/visitors/:id/checkout', requireAuth, async (req: AuthRequest, res) => {
  try {
    const visitorId = Number(req.params.id);
    if (!Number.isFinite(visitorId)) {
      return res.status(400).json({ error: 'Invalid visitor ID.' });
    }
    const result = await checkoutVisitor({ visitorId });
    if (!result) {
      return res.status(404).json({ error: 'Visitor not found.' });
    }
    res.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to check out visitor.';
    res.status(500).json({ error: msg });
  }
});

app.get('/api/admin/appointments', requireAuth, async (req: AuthRequest, res) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const rows = await listAppointments(status);
    res.json({ appointments: rows });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to load appointments.';
    res.status(500).json({ error: msg });
  }
});

app.patch('/api/admin/appointments/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { status, adminNotes } = req.body || {};
    if (!Number.isFinite(id) || !['pending', 'approved', 'rejected', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid appointment update payload.' });
    }
    const updated = await updateAppointmentStatus(
      id,
      status,
      typeof adminNotes === 'string' ? adminNotes : undefined
    );
    if (!updated) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }
    res.json({ appointment: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update appointment.';
    res.status(500).json({ error: msg });
  }
});

app.get('/api/admin/complaints', requireAuth, async (_req: AuthRequest, res) => {
  try {
    const rows = await listComplaints();
    res.json({ complaints: rows });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to load complaints.';
    res.status(500).json({ error: msg });
  }
});

app.patch('/api/admin/complaints/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { status, resolutionNotes } = req.body || {};
    if (!Number.isFinite(id) || !['open', 'in_review', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Invalid complaint update payload.' });
    }
    const updated = await updateComplaintStatus(
      id,
      status,
      typeof resolutionNotes === 'string' ? resolutionNotes : undefined
    );
    if (!updated) {
      return res.status(404).json({ error: 'Complaint ticket not found.' });
    }
    res.json({ complaint: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update complaint.';
    res.status(500).json({ error: msg });
  }
});

app.patch('/api/admin/departments/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid department ID.' });
    }
    const { officeHours, directions, contactExtension, headOfDepartment } = req.body || {};
    const updated = await updateDepartmentInfo(id, {
      ...(typeof officeHours === 'string' ? { officeHours } : {}),
      ...(typeof directions === 'string' ? { directions } : {}),
      ...(typeof contactExtension === 'string' ? { contactExtension } : {}),
      ...(typeof headOfDepartment === 'string' ? { headOfDepartment } : {}),
    });
    if (!updated) {
      return res.status(404).json({ error: 'Department not found.' });
    }
    res.json({ department: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update department.';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/admin/faculty', requireAuth, async (req: AuthRequest, res) => {
  try {
    const {
      name,
      designation,
      departmentId,
      cabinNumber,
      availabilityHours,
      email,
      specialization,
    } = req.body || {};
    if (
      !name ||
      !designation ||
      !departmentId ||
      !cabinNumber ||
      !availabilityHours ||
      !email ||
      !specialization
    ) {
      return res.status(400).json({ error: 'All faculty fields are required.' });
    }
    const created = await createFacultyMember({
      name: String(name),
      designation: String(designation),
      departmentId: Number(departmentId),
      cabinNumber: String(cabinNumber),
      availabilityHours: String(availabilityHours),
      email: String(email),
      specialization: String(specialization),
    });
    res.status(201).json({ faculty: created });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to add faculty member.';
    res.status(500).json({ error: msg });
  }
});

app.patch('/api/admin/faculty/:id/availability', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { isAvailable } = req.body || {};
    if (!Number.isFinite(id) || typeof isAvailable !== 'boolean') {
      return res.status(400).json({ error: 'Valid faculty ID and availability flag required.' });
    }
    const updated = await toggleFacultyAvailability(id, isAvailable);
    if (!updated) {
      return res.status(404).json({ error: 'Faculty member not found.' });
    }
    res.json({ faculty: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update faculty availability.';
    res.status(500).json({ error: msg });
  }
});

// --- Server & WebSocket Setup (Live API) ---

// const server = http.createServer(app);
// const wss = new WebSocketServer({ server, path: '/ws/live' });

const server = http.createServer(app);

const allowedWsOrigins = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

if (process.env.RENDER_EXTERNAL_URL) {
  allowedWsOrigins.add(new URL(process.env.RENDER_EXTERNAL_URL).origin);
}

const wss = new WebSocketServer({
  server,
  path: '/ws/live',
  maxPayload: 2 * 1024 * 1024,
  verifyClient: (info, done) => {
    const origin = info.origin;

    if (!origin || !allowedWsOrigins.has(origin)) {
      done(false, 403, 'Origin not allowed');
      return;
    }

    done(true);
  },
});

wss.on('connection', async (clientWs: WebSocket) => {
  let closed = false;
  let sessionRef: Awaited<ReturnType<ReturnType<typeof getLiveAiClient>['live']['connect']>> | null =
    null;

  const safeSend = (payload: unknown) => {
    if (!closed && clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify(payload));
    }
  };

  try {
    const aiClient = getLiveAiClient();
    const session = await aiClient.live.connect({
      model: 'gemini-3.8-live',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Kore',
            },
          },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: VISIONDESK_SYSTEM_PROMPT,
        tools: [{ functionDeclarations: receptionFunctionDeclarations }],
      },
      callbacks: {
        onmessage: async (message: LiveServerMessage) => {
          const serverContent = message.serverContent;
          if (serverContent?.inputTranscription?.text) {
            safeSend({
              type: 'inputTranscript',
              text: serverContent.inputTranscription.text,
            });
          }
          if (serverContent?.outputTranscription?.text) {
            safeSend({
              type: 'outputTranscript',
              text: serverContent.outputTranscription.text,
            });
          }
          if (serverContent?.interrupted) {
            safeSend({ type: 'interrupted' });
          }
          if (serverContent?.turnComplete) {
            safeSend({ type: 'turnComplete' });
          }

          for (const part of serverContent?.modelTurn?.parts ?? []) {
            if (part.inlineData?.data) {
              safeSend({ type: 'audio', data: part.inlineData.data });
            }
          }

          const calls = message.toolCall?.functionCalls ?? [];
          if (calls.length > 0) {
            const functionResponses = [];
            for (const call of calls) {
              const result = await executeReceptionTool(
                call.name || '',
                (call.args as Record<string, unknown>) || {}
              );
              safeSend({
                type: 'operation',
                operation: result,
              });
              functionResponses.push({
                id: call.id,
                name: call.name,
                response: result as Record<string, unknown>,
              });
            }
            session.sendToolResponse({ functionResponses });
          }
        },
        onerror: (err: unknown) => {
          console.error('Gemini Live session error:', err);
          const detail =
            err && typeof err === 'object' && 'message' in err
              ? String((err as { message: unknown }).message)
              : String(err);
          safeSend({
            type: 'error',
            message: `Live voice connection error: ${detail}`,
          });
        },
        onclose: (event: unknown) => {
          console.log('Gemini Live session closed:', event);
          safeSend({ type: 'closed', detail: event });
        },
      },
    });

    sessionRef = session;
    safeSend({ type: 'ready' });
  } catch (error) {
    console.error('Failed to open Gemini Live session:', error);
    safeSend({
      type: 'error',
      message: error instanceof Error ? error.message : 'Unable to start live voice session.',
    });
    clientWs.close();
    return;
  }

  clientWs.on('message', (raw) => {
    if (!sessionRef || closed) return;
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'audio' && typeof msg.data === 'string') {
        sessionRef.sendRealtimeInput({
          audio: { data: msg.data, mimeType: 'audio/pcm;rate=16000' },
        });
      } else if (msg.type === 'video' && typeof msg.data === 'string') {
        sessionRef.sendRealtimeInput({
          video: { data: msg.data, mimeType: 'image/jpeg' },
        });
      } else if (msg.type === 'text' && typeof msg.text === 'string') {
        sessionRef.sendClientContent({
          turns: [{ role: 'user', parts: [{ text: msg.text }] }],
          turnComplete: true,
        });
      }
    } catch (err) {
      console.error('WebSocket message parse error:', err);
    }
  });

  clientWs.on('close', () => {
    closed = true;
    try {
      sessionRef?.close();
    } catch {
      // Ignore cleanup errors
    }
  });
});

// --- Frontend Serving (Vite Dev Middleware or Production Static Dist) ---

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  server.listen(port, '0.0.0.0', () => {
    console.log(`VisionDesk AI server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start VisionDesk AI server:', err);
  process.exit(1);
});
