// Global / default — Dubai
export const WHATSAPP_NUMBER = "971563704103";
export const WHATSAPP_DISPLAY = "+971 56 370 4103";

// Regional — Uganda Product Manager
export const WHATSAPP_UG_NUMBER = "256774549869";
export const WHATSAPP_UG_DISPLAY = "+256 774 549 869";

export function buildWhatsAppUrl(message: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function buildWhatsAppUgUrl(message: string) {
  return `https://wa.me/${WHATSAPP_UG_NUMBER}?text=${encodeURIComponent(message)}`;
}
