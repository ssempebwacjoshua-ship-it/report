import type { ComponentNode, DocumentSchema } from "../../shared/types/documentIntelligence";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type RenderSettings = {
  fitToOnePage?: boolean;
  compact?: boolean;
  fontScale?: number;
  spacing?: "normal" | "compact";
};

function renderComponent(node: ComponentNode, primaryColor: string, compact = false): string {
  const p = node.props as Record<string, unknown>;
  const blockClass = compact ? " block compact-block" : " block";
  switch (node.type) {
    case "header":
      return `<div class="header" style="background:linear-gradient(135deg,${esc(p.primaryColor ?? primaryColor)},${esc(p.primaryColor ?? primaryColor)}cc)">
        ${p.logoText ? `<div class="logo-text">${esc(p.logoText)}</div>` : ""}
        <h1>${esc(p.title)}</h1>
        ${p.subtitle ? `<p class="subtitle">${esc(p.subtitle)}</p>` : ""}
        ${p.date ? `<p class="date">${esc(p.date)}</p>` : ""}
      </div>`;

    case "textBlock":
      return `<div class="text-block${blockClass}">
        ${p.heading ? `<h2 class="section-heading">${esc(p.heading)}</h2>` : ""}
        <p>${esc(p.content)}</p>
      </div>`;

    case "table": {
      const cols = (p.columns as string[]) ?? [];
      const rows = (p.rows as Record<string, string | number>[]) ?? [];
      return `<div class="table-block${blockClass}">
        ${p.heading ? `<h2 class="section-heading">${esc(p.heading)}</h2>` : ""}
        <table><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((r, i) => `<tr class="${i % 2 === 0 ? "" : "alt"}">${cols.map((c) => `<td>${esc(r[c])}</td>`).join("")}</tr>`).join("")}</tbody></table>
      </div>`;
    }

    case "statistics": {
      const items = (p.items as { label: string; value: string | number; change?: string }[]) ?? [];
      return `<div class="stats-block${blockClass}">
        ${p.heading ? `<h2 class="section-heading">${esc(p.heading)}</h2>` : ""}
        <div class="stats-grid">${items.map((item) => `<div class="stat-item">
          <p class="stat-label">${esc(item.label)}</p>
          <p class="stat-value">${esc(item.value)}</p>
          ${item.change ? `<p class="stat-change">${esc(item.change)}</p>` : ""}
        </div>`).join("")}</div>
      </div>`;
    }

    case "aiSummary":
      return `<div class="ai-summary${blockClass}">
        <div class="ai-badge">${esc(p.heading ?? "AI Summary")}</div>
        <p>${esc(p.content)}</p>
      </div>`;

    case "profileCard": {
      const fields = (p.fields as { label: string; value: string }[]) ?? [];
      const initials = String(p.avatarText ?? p.name ?? "?").slice(0, 2).toUpperCase();
      return `<div class="profile-card${blockClass}">
        <div class="avatar">${esc(initials)}</div>
        <div class="profile-info">
          <p class="profile-name">${esc(p.name)}</p>
          ${p.subtitle ? `<p class="profile-sub">${esc(p.subtitle)}</p>` : ""}
          <div class="profile-fields">${fields.map((f) => `<div><span class="field-label">${esc(f.label)}</span><span class="field-val">${esc(f.value)}</span></div>`).join("")}</div>
        </div>
      </div>`;
    }

    case "signature":
      return `<div class="signature${blockClass}">
        <div class="sig-line"></div>
        <p class="sig-label">${esc(p.label ?? "Signature")}</p>
        ${p.name ? `<p class="sig-name">${esc(p.name)}</p>` : ""}
        ${p.date ? `<p class="sig-date">${esc(p.date)}</p>` : ""}
      </div>`;

    case "chart": {
      const labels = (p.labels as string[]) ?? [];
      const data = (p.data as number[]) ?? [];
      const max = Math.max(...data, 1);
      const barW = 40;
      const chartH = 120;
      const svgW = Math.max(labels.length * (barW + 10) + 20, 200);
      const bars = labels.map((label, i) => {
        const barH = Math.round((data[i] ?? 0) / max * chartH);
        const x = 10 + i * (barW + 10);
        const y = chartH - barH + 10;
        return `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${primaryColor}" opacity="0.8" rx="2"/>
          <text x="${x + barW / 2}" y="${chartH + 25}" text-anchor="middle" font-size="9" fill="#64748b">${esc(label)}</text>
          <text x="${x + barW / 2}" y="${y - 3}" text-anchor="middle" font-size="9" fill="#334155">${esc(data[i])}</text>`;
      }).join("");
      return `<div class="chart-block${blockClass}">
        ${p.heading ? `<h2 class="section-heading">${esc(p.heading)}</h2>` : ""}
        <svg width="${svgW}" height="${chartH + 40}" overflow="visible">${bars}</svg>
      </div>`;
    }

    case "timeline": {
      const items = (p.items as { date: string; title: string; description?: string }[]) ?? [];
      return `<div class="timeline${blockClass}">
        ${p.heading ? `<h2 class="section-heading">${esc(p.heading)}</h2>` : ""}
        ${items.map((item) => `<div class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-content">
            <p class="timeline-date">${esc(item.date)}</p>
            <p class="timeline-title">${esc(item.title)}</p>
            ${item.description ? `<p class="timeline-desc">${esc(item.description)}</p>` : ""}
          </div>
        </div>`).join("")}
      </div>`;
    }

    case "footer": {
      return `<div class="footer">
        <span>${esc(p.left ?? "")}</span>
        <span>${esc(p.center ?? "")}</span>
        <span>${esc(p.right ?? "")}</span>
      </div>`;
    }

    default:
      return "";
  }
}

export function renderSchemaToHtml(
  schema: DocumentSchema,
  componentTree: ComponentNode[],
  title = "Document",
  renderSettings: RenderSettings = {},
): string {
  const primaryColor = schema.theme?.primaryColor ?? "#2563eb";
  const pageSize = schema.theme?.pageSize ?? "A4";
  const orientation = schema.theme?.orientation ?? "PORTRAIT";
  const compact = Boolean(renderSettings.compact || renderSettings.fitToOnePage || renderSettings.spacing === "compact");
  const body = componentTree.map((node) => renderComponent(node, primaryColor, compact)).join("\n");
  const pageMargin = compact ? "10mm" : "14mm";
  const maxWidth = orientation === "LANDSCAPE" ? "1040px" : "780px";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html{background:#f1f5f9}
body{font-family:system-ui,-apple-system,sans-serif;color:#1e293b;background:#f1f5f9;padding:16px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
img,svg,table{max-width:100%}
.doc{max-width:${maxWidth};margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08)}
.block{page-break-inside:avoid;break-inside:avoid}
.compact-block{padding-top:10px!important;padding-bottom:10px!important}
.header{padding:${compact ? "16px 22px" : "24px 28px"};color:#fff;page-break-inside:avoid;break-inside:avoid}
.header h1{font-size:1.4rem;font-weight:900;line-height:1.2}
.header .subtitle{margin-top:4px;opacity:.85;font-size:.9rem}
.header .date{margin-top:8px;opacity:.7;font-size:.75rem}
.logo-text{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,.2);font-weight:900;font-size:.85rem;margin-bottom:12px}
.section-heading{font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin-bottom:8px}
.text-block,.table-block,.stats-block,.ai-summary,.profile-card,.signature,.chart-block,.timeline{padding:${compact ? "10px 22px" : "16px 28px"};border-bottom:1px solid #f1f5f9}
.text-block p{font-size:.875rem;line-height:1.6;color:#475569}
table{width:100%;border-collapse:collapse;font-size:${compact ? ".72rem" : ".8rem"};table-layout:fixed;page-break-inside:auto}
thead{display:table-header-group}
tr{page-break-inside:avoid;break-inside:avoid}
th{text-align:left;padding:8px 10px;background:#f8fafc;font-weight:700;color:#475569;border-bottom:2px solid #e2e8f0}
td{padding:${compact ? "5px 8px" : "7px 10px"};color:#334155;border-bottom:1px solid #f1f5f9;overflow-wrap:anywhere}
tr.alt td{background:#f8fafc}
.stats-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.stat-item{background:#f8fafc;border-radius:8px;padding:12px;border:1px solid #e2e8f0}
.stat-label{font-size:.7rem;color:#64748b}
.stat-value{font-size:1.4rem;font-weight:900;color:#0f172a;margin-top:2px}
.stat-change{font-size:.7rem;color:#059669;margin-top:2px}
.ai-summary{background:#eff6ff;border-left:3px solid ${esc(primaryColor)}}
.ai-badge{font-size:.7rem;font-weight:700;color:${esc(primaryColor)};margin-bottom:6px}
.ai-summary p{font-size:.875rem;color:#1e3a5f;line-height:1.6}
.profile-card{display:flex;gap:16px;align-items:flex-start}
.avatar{flex-shrink:0;width:48px;height:48px;border-radius:50%;background:#dbeafe;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:.85rem;color:#1d4ed8}
.profile-name{font-weight:700;font-size:1rem}
.profile-sub{font-size:.8rem;color:#64748b;margin-top:2px}
.profile-fields{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}
.field-label{display:block;font-size:.65rem;text-transform:uppercase;color:#94a3b8}
.field-val{font-size:.8rem;color:#334155}
.signature{padding:20px 28px}
.sig-line{width:160px;height:1px;background:#cbd5e1;margin-bottom:6px}
.sig-label{font-size:.75rem;font-weight:600;color:#475569}
.sig-name{font-size:.75rem;color:#64748b;margin-top:2px}
.sig-date{font-size:.7rem;color:#94a3b8;margin-top:2px}
.chart-block svg{overflow:visible;display:block;margin-top:8px;max-width:100%;height:auto;page-break-inside:avoid;break-inside:avoid}
.timeline{position:relative}
.timeline-item{display:flex;gap:12px;margin-bottom:12px;padding-left:8px}
.timeline-dot{flex-shrink:0;width:10px;height:10px;border-radius:50%;background:${esc(primaryColor)};margin-top:4px}
.timeline-date{font-size:.7rem;color:#64748b}
.timeline-title{font-size:.875rem;font-weight:700;color:#0f172a}
.timeline-desc{font-size:.8rem;color:#475569;margin-top:2px}
.footer{display:flex;justify-content:space-between;padding:12px 28px;font-size:.7rem;color:#94a3b8;border-top:1px solid #e2e8f0}
@media print{
  html,body{background:#fff;padding:0;width:auto;overflow:visible}
  .doc{box-shadow:none;border-radius:0;max-width:none;width:100%;overflow:visible}
  .text-block,.table-block,.stats-block,.ai-summary,.profile-card,.signature,.chart-block,.timeline{border-bottom:1px solid #e2e8f0}
  @page{size:${pageSize} ${orientation};margin:${pageMargin}}
}
@media screen and (max-width:640px){
  body{padding:10px}
  .doc{border-radius:10px}
  .header{padding:18px}
  .text-block,.table-block,.stats-block,.ai-summary,.profile-card,.signature,.chart-block,.timeline{padding:14px 16px}
  table{font-size:.75rem}
}
</style>
</head>
<body>
<div class="doc">
${body}
</div>
</body>
</html>`;
}

