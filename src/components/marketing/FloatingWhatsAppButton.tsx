import { buildWhatsAppUrl } from "../../config/contact";

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.38 2.13 11.76c0 1.72.46 3.4 1.33 4.87L2 22l5.52-1.42a10.1 10.1 0 0 0 4.52 1.08h.01c5.46 0 9.91-4.38 9.91-9.76C21.96 6.38 17.51 2 12.04 2Zm0 17.97h-.01a8.35 8.35 0 0 1-4.25-1.16l-.31-.18-3.27.84.87-3.12-.2-.32a7.91 7.91 0 0 1-1.22-4.27c0-4.44 3.76-8.05 8.39-8.05 2.24 0 4.35.86 5.93 2.38a7.86 7.86 0 0 1 2.46 5.71c0 4.44-3.76 8.17-8.39 8.17Zm4.6-6.1c-.25-.12-1.49-.72-1.72-.8-.23-.08-.4-.12-.57.12-.17.25-.65.8-.8.96-.15.17-.3.19-.55.06-.25-.12-1.06-.38-2.02-1.2-.75-.66-1.25-1.47-1.4-1.72-.15-.25-.02-.38.11-.5.12-.11.25-.3.38-.45.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.43-.06-.12-.57-1.35-.78-1.85-.2-.49-.41-.42-.57-.43h-.49c-.17 0-.43.06-.66.31-.23.25-.87.84-.87 2.05s.89 2.38 1.02 2.55c.13.17 1.75 2.63 4.24 3.68.59.25 1.05.4 1.41.51.59.18 1.13.15 1.56.09.48-.07 1.49-.6 1.7-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.16-.48-.28Z" />
    </svg>
  );
}

export function FloatingWhatsAppButton() {
  const message = "Hello SSAMENJ Technologies! I would like to request a demo.";

  return (
    <a
      href={buildWhatsAppUrl(message)}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with School Connect on WhatsApp"
      className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-3 text-sm font-black text-white shadow-xl shadow-emerald-600/25 transition hover:-translate-y-0.5 hover:shadow-2xl"
    >
      <WhatsAppIcon />
      <span className="hidden sm:inline">Chat on WhatsApp</span>
      <span className="sm:hidden">Chat</span>
    </a>
  );
}
