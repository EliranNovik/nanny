import { cn } from "@/lib/utils";

interface WhatsAppButtonProps {
  phoneNumber?: string;
  className?: string;
  message?: string;
}

export function WhatsAppButton({
  phoneNumber = "1234567890",
  className,
  message = "Hi MamaLama! I have a question about your services.",
}: WhatsAppButtonProps) {
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "fixed right-6 bottom-24 md:bottom-10 z-[100] group flex items-center transition-all duration-300",
        className,
      )}
      aria-label="Chat on WhatsApp"
    >
      {/* Tooltip on hover */}
      <span className="mr-3 px-3 py-1.5 rounded-lg bg-white/95 backdrop-blur-md text-[#25D366] text-sm font-bold shadow-2xl border border-emerald-100 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0">
        Chat with us
      </span>

      {/* Branded Green Button with White Icon */}
      <div className="h-16 w-16 rounded-full bg-[#25D366] flex items-center justify-center shadow-[0_12px_40px_rgb(37,211,102,0.4)] hover:shadow-[0_12px_40px_rgb(37,211,102,0.6)] hover:scale-110 active:scale-95 transition-all">
        {/* Custom WhatsApp-like SVG for authenticity */}
        <svg
          viewBox="0 0 24 24"
          className="w-10 h-10 fill-white"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.539 2.016 2.126-.54c1.029.563 2.025.845 3.162.845 3.181 0 5.767-2.587 5.768-5.766 0-3.18-2.587-5.767-5.768-5.767m.001 10.435c-1.031 0-2.036-.256-2.923-.74l-.21-.122-1.258.33.34-1.21-.144-.229c-.587-.933-.896-2.016-.895-3.13 0-2.531 2.059-4.59 4.59-4.59s4.589 2.059 4.589 4.59-2.058 4.591-4.589 4.591m2.715-3.715c-.149-.074-.881-.434-1.017-.484-.136-.05-.236-.074-.335.074s-.383.484-.469.584c-.086.1-.173.111-.322.037-.149-.075-.63-.232-1.2-.741-.444-.396-.744-.885-.831-1.034-.087-.149-.009-.23.065-.304.067-.066.149-.174.223-.261.074-.087.1-.149.149-.248.05-.1.025-.186-.012-.261s-.335-.807-.459-1.104c-.12-.291-.241-.252-.335-.257-.086-.005-.186-.006-.285-.006s-.261.037-.397.186c-.136.149-.521.509-.521 1.24s.534 1.44.608 1.54c.074.1 1.052 1.605 2.55 2.251.357.153.635.245.853.314.358.114.685.098.943.06.287-.043.882-.361 1.006-.708.124-.347.124-.645.087-.708-.037-.063-.136-.1-.285-.174" />
        </svg>
      </div>
    </a>
  );
}
