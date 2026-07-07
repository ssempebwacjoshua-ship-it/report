import { buildWhatsAppUrl } from "../../config/contact";
import { WhatsAppIcon } from "./Icons";

export function FloatingWhatsAppButton() {
  const message = "Hello SSAMENJ Technologies! I would like to request a demo.";

  return (
    <a
      href={buildWhatsAppUrl(message)}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat on WhatsApp"
      className="motion-cta fixed bottom-8 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-xl shadow-emerald-600/30 hover:-translate-y-1 hover:scale-110 hover:shadow-2xl hover:shadow-emerald-600/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
    >
      <WhatsAppIcon className="h-6 w-6" />
    </a>
  );
}
