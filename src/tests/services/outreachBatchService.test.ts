import { describe, expect, it, vi } from "vitest";

vi.mock("../../server/services/emailService", () => ({
  sendOutreachEmail: vi.fn(async () => ({ ok: true, provider: "RESEND", messageId: "msg-1" })),
  configuredCompanyReplyTo: vi.fn(() => "support@ssamenj.online"),
  configuredCompanySender: vi.fn(() => "SSAMENJ Technologies <support@ssamenj.online>"),
}));

import { buildOutreachBatchReport, sendEligibleOutreachBatch } from "../../server/services/outreachBatchService";

describe("outreach batch service", () => {
  it("classifies leads and prepares company drafts", () => {
    const report = buildOutreachBatchReport([
      { to: "info@school-a.com", schoolName: "School A", subject: "A", html: "<p>A</p>", text: "A" },
      { to: "info@school-a.com", schoolName: "School A duplicate", subject: "A2", html: "<p>A2</p>", text: "A2" },
      { to: "info@school-b.com", schoolName: "School B", subject: "B", html: "<p>B</p>", text: "B", outreachStatus: "bounced" },
      { to: "info@gmail.com", schoolName: "Bad", subject: "Bad", html: "<p>Bad</p>", text: "Bad" },
    ]);

    expect(report.totalReviewed).toBe(4);
    expect(report.eligibleToResend).toBe(1);
    expect(report.skippedDuplicates).toBe(1);
    expect(report.skippedBounced).toBe(1);
    expect(report.skippedInvalidOrSuspicious).toBe(1);
    expect(report.draftsUpdatedOrCreated).toBe(1);
    expect(report.items.find((item) => item.to === "info@school-a.com" && item.outreachStatus === "eligible_for_company_resend")?.newSender)
      .toBe("SSAMENJ Technologies <support@ssamenj.online>");
  });

  it("sends only eligible leads with the official reply-to", async () => {
    const { sendOutreachEmail } = await import("../../server/services/emailService");
    const spy = vi.mocked(sendOutreachEmail);
    spy.mockClear();

    await sendEligibleOutreachBatch([
      { to: "info@school-c.com", schoolName: "School C", subject: "C", html: "<p>C</p>", text: "C" },
      { to: "info@school-d.com", schoolName: "School D", subject: "D", html: "<p>D</p>", text: "D", outreachStatus: "replied_not_interested" },
    ]);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      to: "info@school-c.com",
      replyTo: "support@ssamenj.online",
    }));
  });

  it("does not resend to contacts already sent from the company email", () => {
    const report = buildOutreachBatchReport([
      {
        to: "info@school-e.com",
        schoolName: "School E",
        subject: "E",
        html: "<p>E</p>",
        text: "E",
        outreachStatus: "already_sent_from_company_email",
      },
    ]);

    expect(report.eligibleToResend).toBe(0);
    expect(report.items[0]?.skippedReason).toBeTruthy();
  });
});
