export function getWhatsAppLink(number: string): string {
  const cleaned = number.replace(/[^\d]/g, "");
  return `https://wa.me/${cleaned}`;
}

export function getTelegramLink(username: string): string {
  const handle = username.replace(/^@/, "");
  return `https://t.me/${handle}`;
}
