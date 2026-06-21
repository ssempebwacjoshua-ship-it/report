export const WHATSAPP_NUMBER = "256790685650";
export const WHATSAPP_DISPLAY = "+256 790 685 650";

export function buildWhatsAppUrl(message: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
