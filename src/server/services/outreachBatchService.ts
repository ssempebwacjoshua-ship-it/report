import { sendOutreachEmail } from "./emailService";

export type OutreachLeadStatus =
  | "eligible_for_company_resend"
  | "bounced"
  | "replied_interested"
  | "replied_not_interested"
  | "needs_human_followup"
  | "wrong_contact"
  | "duplicate"
  | "invalid_or_suspicious"
  | "already_drafted_from_company_email"
  | "already_sent_from_company_email";

export type OutreachLead = {
  to: string;
  schoolName: string;
  subject: string;
  html: string;
  text: string;
  previousSender?: string | null;
  newSender?: string | null;
  outreachStatus?: OutreachLeadStatus;
  bounceStatus?: "bounced" | "none";
  replyStatus?: "replied_interested" | "replied_not_interested" | "needs_human_followup" | "none";
  draftStatus?: "drafted" | "not_drafted";
  resentFromOfficialAt?: string | null;
};

export type OutreachBatchItem = OutreachLead & {
  normalizedTo: string;
  skippedReason?: string;
};

export type OutreachBatchReport = {
  totalReviewed: number;
  eligibleToResend: number;
  skippedBounced: number;
  skippedRepliedNotInterested: number;
  skippedWrongContacts: number;
  skippedDuplicates: number;
  skippedInvalidOrSuspicious: number;
  draftsUpdatedOrCreated: number;
  items: OutreachBatchItem[];
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isSafeBusinessEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !/@gmail\.com$/i.test(value) && !/localhost|test|pearlmart/i.test(value);
}

export function buildOutreachBatchReport(leads: OutreachLead[]): OutreachBatchReport {
  const seen = new Set<string>();
  const items: OutreachBatchItem[] = [];
  let skippedBounced = 0;
  let skippedRepliedNotInterested = 0;
  let skippedWrongContacts = 0;
  let skippedDuplicates = 0;
  let skippedInvalidOrSuspicious = 0;

  for (const lead of leads) {
    const normalizedTo = normalizeEmail(lead.to);
    const next: OutreachBatchItem = { ...lead, normalizedTo };

    if (!isSafeBusinessEmail(normalizedTo)) {
      next.outreachStatus = "invalid_or_suspicious";
      next.skippedReason = "Unsafe or invalid recipient address.";
      skippedInvalidOrSuspicious += 1;
      items.push(next);
      continue;
    }

    if (seen.has(normalizedTo)) {
      next.outreachStatus = "duplicate";
      next.skippedReason = "Duplicate contact.";
      skippedDuplicates += 1;
      items.push(next);
      continue;
    }
    seen.add(normalizedTo);

    switch (lead.outreachStatus) {
      case "bounced":
        next.skippedReason = "Previously bounced.";
        skippedBounced += 1;
        break;
      case "replied_not_interested":
        next.skippedReason = "Previously replied not interested.";
        skippedRepliedNotInterested += 1;
        break;
      case "wrong_contact":
      case "needs_human_followup":
      case "replied_interested":
        next.skippedReason = "Needs human review.";
        skippedWrongContacts += 1;
        break;
      default:
        next.outreachStatus = "eligible_for_company_resend";
        next.draftStatus = "drafted";
        next.newSender = "Joshua from SSAMENJ Technologies <support@ssamenj.online>";
        next.resentFromOfficialAt = new Date().toISOString();
        break;
    }

    items.push(next);
  }

  const eligibleToResend = items.filter((item) => item.outreachStatus === "eligible_for_company_resend").length;
  const draftsUpdatedOrCreated = items.filter((item) => item.draftStatus === "drafted").length;

  return {
    totalReviewed: leads.length,
    eligibleToResend,
    skippedBounced,
    skippedRepliedNotInterested,
    skippedWrongContacts,
    skippedDuplicates,
    skippedInvalidOrSuspicious,
    draftsUpdatedOrCreated,
    items,
  };
}

export async function sendEligibleOutreachBatch(leads: OutreachLead[]) {
  const report = buildOutreachBatchReport(leads);
  const results = [];

  for (const item of report.items) {
    if (item.outreachStatus !== "eligible_for_company_resend") continue;
    const result = await sendOutreachEmail({
      to: item.to,
      subject: item.subject,
      html: item.html,
      text: item.text,
      replyTo: "support@ssamenj.online",
    });
    results.push({ to: item.to, result });
  }

  return { report, results };
}
