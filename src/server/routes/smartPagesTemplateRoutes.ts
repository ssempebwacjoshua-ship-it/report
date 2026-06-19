import { Router } from "express";
import { getLawyerPageTemplateById, getLawyerPageTemplates } from "../../shared/lawyerTemplates";
import {
  getSmartPageTemplateById,
  getSmartPageTemplates,
  searchSmartPageTemplates,
  type SmartPageTemplateScope,
} from "../../shared/smartPagesTemplates";

const VALID_SCOPES = new Set<SmartPageTemplateScope>(["parsed", "ready", "bulk"]);

function readScope(value: unknown): SmartPageTemplateScope {
  return typeof value === "string" && VALID_SCOPES.has(value as SmartPageTemplateScope)
    ? value as SmartPageTemplateScope
    : "parsed";
}

function lawyerVerticalEnabled(): boolean {
  return process.env.ENABLE_SMART_PAGES_LAWYERS === "true";
}

export function smartPagesTemplateRoutes() {
  const router = Router();

  router.get("/api/smart-pages/school/templates", (req, res) => {
    const scope = readScope(req.query.scope);
    const query = typeof req.query.search === "string" ? req.query.search : "";
    const templates = query.trim()
      ? searchSmartPageTemplates(query, scope, "SCHOOL")
      : getSmartPageTemplates(scope, "SCHOOL");
    res.json({ ok: true, vertical: "SCHOOL", templates });
  });

  router.get("/api/smart-pages/school/templates/:templateId", (req, res) => {
    const template = getSmartPageTemplateById(req.params.templateId, "SCHOOL");
    if (!template) {
      res.status(404).json({ ok: false, error: "Template is not available for School Connect Smart Pages." });
      return;
    }
    res.json({ ok: true, vertical: "SCHOOL", template });
  });

  router.get("/api/smart-pages/lawyer/templates", (req, res) => {
    if (!lawyerVerticalEnabled()) {
      res.status(404).json({ ok: false, error: "Lawyer Smart Pages is not enabled." });
      return;
    }
    const scope = readScope(req.query.scope);
    res.json({ ok: true, vertical: "LAWYER", templates: getLawyerPageTemplates(scope) });
  });

  router.get("/api/smart-pages/lawyer/templates/:templateId", (req, res) => {
    if (!lawyerVerticalEnabled()) {
      res.status(404).json({ ok: false, error: "Lawyer Smart Pages is not enabled." });
      return;
    }
    const template = getLawyerPageTemplateById(req.params.templateId);
    if (!template) {
      res.status(404).json({ ok: false, error: "Template is not available for Lawyer Smart Pages." });
      return;
    }
    res.json({ ok: true, vertical: "LAWYER", template });
  });

  return router;
}
