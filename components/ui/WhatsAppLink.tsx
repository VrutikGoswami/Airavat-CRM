import { MessageSquare } from "lucide-react";

/** Opens WhatsApp with a prefilled message. Digits-only number in the wa.me URL. */
export function WhatsAppLink({
  phone,
  message,
  label = "WhatsApp",
  className = "btn btn-ghost",
}: {
  phone: string;
  message?: string;
  label?: string;
  className?: string;
}) {
  const digits = phone.replace(/[^0-9]/g, "");
  const href = `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      <MessageSquare className="size-4" aria-hidden /> {label}
    </a>
  );
}
