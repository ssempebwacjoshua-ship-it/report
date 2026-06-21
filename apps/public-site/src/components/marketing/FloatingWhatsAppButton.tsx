import { buildWhatsAppUrl } from "../../config/contact";
import { PhoneIcon } from "./Icons";

export function FloatingWhatsAppButton() {
  const message = "Hello SSAMENJ Technologies! I would like to request a demo.";

  return (
    <a
      href={buildWhatsAppUrl(message)}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with SSAMENJ Technologies on WhatsApp"
      className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-3 text-sm font-black text-white shadow-xl shadow-emerald-600/25 transition hover:-translate-y-0.5 hover:shadow-2xl"
    >
      <PhoneIcon className="h-5 w-5" />
      <span className="hidden sm:inline">Chat on WhatsApp</span>
      <span className="sm:hidden">Chat</span>
    </a>
  );
}
