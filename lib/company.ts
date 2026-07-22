/**
 * Company identity for customer-facing CRM surfaces — the printable quotation
 * document, the public share view and the settings screen.
 *
 * These values mirror the website's `config/company.ts` so the two systems
 * present one coherent brand (same name, contact details and address). Keep
 * them in sync: if a detail changes, update it here and in the website config.
 */
export const company = {
  name: "Airavat Tours and Travels",
  legalName: "Airavat Tours and Travel Limited",
  tagline: "Tours & travel from Kenya",
  phone: "+254 101 490033",
  whatsapp: "254101490033",
  email: "info@airavat.biz",
  website: "www.airavat.biz",
  address: "602, NML Towers, Tsavo Road, South B, Nairobi, 18815-00500, Kenya",
  city: "Nairobi, Kenya",
  currency: "KES",
} as const;

/** Compact one-line contact string for letterheads and footers. */
export function companyContactLine(): string {
  return [company.phone, company.email, company.website].join("  ·  ");
}
