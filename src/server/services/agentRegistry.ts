import type { DocumentSchema, ExtractedKnowledge } from "../../shared/types/documentIntelligence";
import { runGeminiAgent } from "./documentGeminiService";

export type AgentDomain = "school" | "medical" | "legal" | "business" | "general";

export interface DomainAgent {
  id: AgentDomain;
  label: string;
  domainHints: string[];
  systemPrompt: string;
}

export const schoolAgent: DomainAgent = {
  id: "school",
  label: "School Agent",
  domainHints: ["report cards", "marks", "rankings", "comments", "class summaries"],
  systemPrompt: "You understand school report cards, marks, rankings, comments, class summaries, and parent-facing language.",
};

export const medicalAgent: DomainAgent = {
  id: "medical",
  label: "Medical Agent",
  domainHints: ["patient records", "vitals", "diagnoses", "prescriptions", "clinical summaries"],
  systemPrompt: "You understand patient records, vitals, diagnoses, prescriptions, and concise clinical summaries.",
};

export const legalAgent: DomainAgent = {
  id: "legal",
  label: "Legal Agent",
  domainHints: ["case files", "timelines", "evidence", "court dates", "chronologies"],
  systemPrompt: "You understand case files, timelines, evidence, court dates, and careful legal chronology writing.",
};

export const businessAgent: DomainAgent = {
  id: "business",
  label: "Business Agent",
  domainHints: ["invoices", "proposals", "KPIs", "reports", "executive summaries"],
  systemPrompt: "You understand invoices, proposals, KPIs, operational reports, and executive summaries.",
};

export const generalAgent: DomainAgent = {
  id: "general",
  label: "General Document Agent",
  domainHints: ["documents", "summaries", "layouts", "workflow"],
  systemPrompt: "You are a general document operating system agent. Avoid industry-specific assumptions unless the document supports them.",
};

export const agentRegistry = {
  schoolAgent,
  medicalAgent,
  legalAgent,
  businessAgent,
  generalAgent,
};

export function pickAgent(domain?: string | null): DomainAgent {
  const normalized = domain?.toLowerCase() ?? "";
  if (/school|education|student|marks|report/.test(normalized)) return schoolAgent;
  if (/medical|health|patient|clinic/.test(normalized)) return medicalAgent;
  if (/legal|case|court|law/.test(normalized)) return legalAgent;
  if (/business|invoice|proposal|kpi|executive/.test(normalized)) return businessAgent;
  return generalAgent;
}

export async function runAgent(
  agent: DomainAgent,
  instruction: string,
  context: {
    knowledge?: ExtractedKnowledge | null;
    schema?: DocumentSchema | null;
    preferences?: Record<string, unknown>;
  },
): Promise<{ agentId: string; agentLabel: string; response: string; suggestedActions: string[] }> {
  try {
    const response = await runGeminiAgent({
      systemPrompt: agent.systemPrompt,
      instruction,
      context,
    });
    return {
      agentId: agent.id,
      agentLabel: agent.label,
      response: response.response,
      suggestedActions: response.suggestedActions,
    };
  } catch {
    return {
      agentId: agent.id,
      agentLabel: agent.label,
      response: `${agent.label} can help with: ${agent.domainHints.join(", ")}. Gemini is not configured, so no reasoning response was generated.`,
      suggestedActions: ["Configure GEMINI_API_KEY", "Open the document editor", "Try the request again"],
    };
  }
}
