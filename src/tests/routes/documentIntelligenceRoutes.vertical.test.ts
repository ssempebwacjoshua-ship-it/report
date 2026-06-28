/**
 * Route-level vertical isolation tests for /api/smart-documents.
 *
 * Proves that:
 * - GET ?vertical=LAWYER passes LAWYER to the service (no silent drop).
 * - POST { vertical: "LAWYER" } creates a LAWYER doc.
 * - POST with no vertical defaults to SCHOOL (not undefined).
 * - Lawyer creator + no vertical → 403 from service (not silent SCHOOL creation).
 * - Invalid vertical values return 400 (parseSmartDocumentVertical throws).
 * - Guardrail: routes file uses parseSmartDocumentVertical and parsedVertical.
 * - Guardrail: shared types export SmartDocumentVertical with vertical on summary.
 */

import request from "supertest";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks (hoisted before any imports) ──────────────────────────────────────

const svcMocks = vi.hoisted(() => ({
  listDocuments: vi.fn(),
  createDocument: vi.fn(),
  getDocument: vi.fn(),
  getPublishedDocument: vi.fn(),
  downloadPublishedDocumentPdf: vi.fn(),
  uploadAndExtract: vi.fn(),
  retryDocumentExtraction: vi.fn(),
  updateExtractedKnowledge: vi.fn(),
  generateSchema: vi.fn(),
  applyPrompt: vi.fn(),
  createManualDocumentVersion: vi.fn(),
  getLawyerDocumentEditPlan: vi.fn(),
  getVersionHistory: vi.fn(),
  restoreVersion: vi.fn(),
  publishDocument: vi.fn(),
  findCreatorById: vi.fn(),
  findOrCreateSchoolOperatorCreator: vi.fn(),
  assertDocumentVertical: vi.fn(),
}));

const creatorRef = vi.hoisted(() => ({
  current: {
    id: "creator-school",
    type: "SCHOOL_OPERATOR" as "SCHOOL_OPERATOR" | "EXTERNAL",
    email: "school@example.com",
    name: "School Operator",
    schoolId: "school-1" as string | null,
  },
}));

vi.mock("../../server/services/documentIntelligenceService", () => svcMocks);
vi.mock("../../server/middleware/requireCreator", () => ({
  requireCreator: (req: any, _res: any, next: any) => {
    req.creator = creatorRef.current;
    next();
  },
}));

// ── Module import (after mocks are in place) ──────────────────────────────

import { documentIntelligenceRoutes } from "../../server/routes/documentIntelligenceRoutes";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/smart-documents", documentIntelligenceRoutes());
  return app;
}

const schoolCreator = {
  id: "creator-school",
  type: "SCHOOL_OPERATOR" as const,
  email: "school@example.com",
  name: "School Operator",
  schoolId: "school-1" as string | null,
};

const lawyerCreator = {
  id: "creator-ext",
  type: "EXTERNAL" as const,
  email: "lawyer@example.com",
  name: "Lawyer User",
  schoolId: null as string | null,
};

// ── Tests ─────────────────────────────────────────────────────────────────

describe("GET /api/smart-documents — vertical filter routing", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    creatorRef.current = { ...schoolCreator };
    svcMocks.listDocuments.mockResolvedValue([]);
  });

  it("passes vertical=LAWYER to listDocuments and returns its results", async () => {
    const lawyerDoc = {
      id: "doc-1", title: "Demand letter", vertical: "LAWYER",
      status: "DRAFT", versionCount: 0, hasSourceFiles: false,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    svcMocks.listDocuments.mockResolvedValue([lawyerDoc]);

    const res = await request(buildApp()).get("/api/smart-documents?vertical=LAWYER");

    expect(res.status).toBe(200);
    expect(svcMocks.listDocuments).toHaveBeenCalledWith("creator-school", "LAWYER");
    expect(res.body.documents).toHaveLength(1);
    expect(res.body.documents[0].vertical).toBe("LAWYER");
  });

  it("passes vertical=SCHOOL to listDocuments for school query", async () => {
    const res = await request(buildApp()).get("/api/smart-documents?vertical=SCHOOL");

    expect(res.status).toBe(200);
    expect(svcMocks.listDocuments).toHaveBeenCalledWith("creator-school", "SCHOOL");
  });

  it("passes undefined to listDocuments when vertical is omitted (no filter applied)", async () => {
    const res = await request(buildApp()).get("/api/smart-documents");

    expect(res.status).toBe(200);
    expect(svcMocks.listDocuments).toHaveBeenCalledWith("creator-school", undefined);
  });

  it("returns 400 for an unrecognised vertical value", async () => {
    const res = await request(buildApp()).get("/api/smart-documents?vertical=ADMIN");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid smart pages vertical/i);
    expect(svcMocks.listDocuments).not.toHaveBeenCalled();
  });

  it("returns 400 for a numeric vertical value", async () => {
    const res = await request(buildApp()).get("/api/smart-documents?vertical=1");

    expect(res.status).toBe(400);
    expect(svcMocks.listDocuments).not.toHaveBeenCalled();
  });
});

describe("GET /api/smart-documents/p/:token and download routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns a published document snapshot", async () => {
    svcMocks.getPublishedDocument.mockResolvedValue({
      document: {
        id: "doc-public",
        title: "Public Smart Pages",
        status: "READY",
        vertical: "SCHOOL",
        extractionStatus: "READY",
        extractionError: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      publishedAt: new Date().toISOString(),
    });

    const res = await request(buildApp()).get("/api/smart-documents/p/demo-token");

    expect(res.status).toBe(200);
    expect(svcMocks.getPublishedDocument).toHaveBeenCalledWith("demo-token", undefined);
    expect(res.body.ok).toBe(true);
    expect(res.body.document.title).toBe("Public Smart Pages");
  });

  it("returns 404 when the published document is missing", async () => {
    svcMocks.getPublishedDocument.mockResolvedValue(null);

    const res = await request(buildApp()).get("/api/smart-documents/p/missing-token");

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/document not found or link has expired/i);
  });

  it("returns 401 when a password is required", async () => {
    svcMocks.getPublishedDocument.mockResolvedValue("PASSWORD_REQUIRED");

    const res = await request(buildApp()).get("/api/smart-documents/p/locked-token");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("PASSWORD_REQUIRED");
  });

  it("returns 401 when the password is wrong", async () => {
    svcMocks.getPublishedDocument.mockResolvedValue("WRONG_PASSWORD");

    const res = await request(buildApp()).get("/api/smart-documents/p/locked-token?password=bad");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("WRONG_PASSWORD");
  });

  it("returns a PDF download response", async () => {
    svcMocks.downloadPublishedDocumentPdf.mockResolvedValue({
      contentType: "application/pdf",
      body: Buffer.from("pdf-bytes"),
      filename: "public-smart-pages.pdf",
    });

    const res = await request(buildApp()).get("/api/smart-documents/p/demo-token/download/pdf");

    expect(res.status).toBe(200);
    expect(svcMocks.downloadPublishedDocumentPdf).toHaveBeenCalledWith("demo-token", undefined);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["content-disposition"]).toContain("public-smart-pages.pdf");
  });

  it("returns 404 for missing PDF links", async () => {
    svcMocks.downloadPublishedDocumentPdf.mockResolvedValue(null);

    const res = await request(buildApp()).get("/api/smart-documents/p/missing-token/download/pdf");

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/document not found or link has expired/i);
  });

  it("returns 401 for password-protected PDF links", async () => {
    svcMocks.downloadPublishedDocumentPdf.mockResolvedValue("PASSWORD_REQUIRED");

    const res = await request(buildApp()).get("/api/smart-documents/p/locked-token/download/pdf");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("PASSWORD_REQUIRED");
  });

  it("returns 401 for wrong password PDF links", async () => {
    svcMocks.downloadPublishedDocumentPdf.mockResolvedValue("WRONG_PASSWORD");

    const res = await request(buildApp()).get("/api/smart-documents/p/locked-token/download/pdf?password=bad");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("WRONG_PASSWORD");
  });
});

describe("POST /api/smart-documents — vertical routing", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    creatorRef.current = { ...schoolCreator };
  });

  it("creates a LAWYER document when vertical=LAWYER is sent by a lawyer creator", async () => {
    creatorRef.current = { ...lawyerCreator };
    const created = {
      id: "doc-2", title: "Legal Notice", vertical: "LAWYER",
      status: "DRAFT", versionCount: 0, hasSourceFiles: false,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    svcMocks.createDocument.mockResolvedValue(created);

    const res = await request(buildApp())
      .post("/api/smart-documents")
      .send({ title: "Legal Notice", vertical: "LAWYER" });

    expect(res.status).toBe(201);
    expect(svcMocks.createDocument).toHaveBeenCalledWith("creator-ext", "Legal Notice", "LAWYER");
    expect(res.body.document.vertical).toBe("LAWYER");
  });

  it("defaults vertical to SCHOOL when vertical is not provided", async () => {
    const created = {
      id: "doc-3", title: "School Report", vertical: "SCHOOL",
      status: "DRAFT", versionCount: 0, hasSourceFiles: false,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    svcMocks.createDocument.mockResolvedValue(created);

    const res = await request(buildApp())
      .post("/api/smart-documents")
      .send({ title: "School Report" });

    expect(res.status).toBe(201);
    expect(svcMocks.createDocument).toHaveBeenCalledWith("creator-school", "School Report", "SCHOOL");
  });

  it("returns 400 for an invalid vertical value", async () => {
    const res = await request(buildApp())
      .post("/api/smart-documents")
      .send({ title: "Bad doc", vertical: "HACK" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid smart pages vertical/i);
    expect(svcMocks.createDocument).not.toHaveBeenCalled();
  });

  it("propagates 403 when a lawyer creator sends no vertical (defaults to SCHOOL → service rejects)", async () => {
    // This verifies the route passes SCHOOL as default, and the service guard fires.
    creatorRef.current = { ...lawyerCreator };
    svcMocks.createDocument.mockRejectedValue(
      Object.assign(
        new Error("Lawyer accounts cannot create School Smart Pages documents."),
        { status: 403 },
      ),
    );

    const res = await request(buildApp())
      .post("/api/smart-documents")
      .send({ title: "Untitled" });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/lawyer accounts cannot create school smart pages/i);
    // Route must have passed SCHOOL (the default) — not undefined
    expect(svcMocks.createDocument).toHaveBeenCalledWith("creator-ext", "Untitled", "SCHOOL");
  });

  it("propagates 403 when a school operator sends vertical=LAWYER (service cross-vertical guard)", async () => {
    svcMocks.createDocument.mockRejectedValue(
      Object.assign(
        new Error("School accounts cannot create Lawyer Smart Pages documents."),
        { status: 403 },
      ),
    );

    const res = await request(buildApp())
      .post("/api/smart-documents")
      .send({ title: "Bad", vertical: "LAWYER" });

    expect(res.status).toBe(403);
    expect(svcMocks.createDocument).toHaveBeenCalledWith("creator-school", "Bad", "LAWYER");
  });
});

describe("parseSmartDocumentVertical guardrail coverage", () => {
  it("routes file contains parseSmartDocumentVertical and parsedVertical identifiers", () => {
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    const routesContent = fs.readFileSync(
      path.join(process.cwd(), "src/server/routes/documentIntelligenceRoutes.ts"),
      "utf-8",
    );
    expect(/parseSmartDocumentVertical/.test(routesContent)).toBe(true);
    expect(/parsedVertical/.test(routesContent)).toBe(true);
  });

  it("a route calling listDocuments without vertical would NOT pass the guardrail structural check", () => {
    // The guardrail requires parseSmartDocumentVertical to be present in the routes file.
    // Code that omits it (like legacy code) would fail the pattern check.
    const legacyRouteCode = `const documents = await svc.listDocuments(req.creator.id);`;
    expect(/parseSmartDocumentVertical/.test(legacyRouteCode)).toBe(false);
  });

  it("shared types exports SmartDocumentVertical and SmartDocumentSummary includes vertical field", () => {
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    const typesContent = fs.readFileSync(
      path.join(process.cwd(), "src/shared/types/documentIntelligence.ts"),
      "utf-8",
    );
    expect(/export type SmartDocumentVertical/.test(typesContent)).toBe(true);
    expect(/vertical\s*:\s*SmartDocumentVertical/.test(typesContent)).toBe(true);
  });
});
