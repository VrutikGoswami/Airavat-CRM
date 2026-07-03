import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Enter a name"),
  whatsapp: z.string().trim().min(6, "Enter a contact number"),
  email: z.string().trim().email("Enter a valid email").or(z.literal("")),
  type: z.enum(["individual", "family", "corporate", "group"]),
  assignedConsultantId: z.string().min(1, "Assign a consultant"),
  preferredContact: z.enum(["whatsapp", "phone", "email"]),
  preferences: z.string().max(500).optional().or(z.literal("")),
});
export type CustomerForm = z.infer<typeof customerSchema>;

export const enquirySchema = z.object({
  customerId: z.string().min(1, "Choose a customer"),
  service: z.enum(["flights", "hotel", "safari", "holiday-package", "transport", "corporate", "group"]),
  origin: z.string().trim().max(120).optional().or(z.literal("")),
  destination: z.string().trim().min(2, "Enter a destination"),
  travelStartDate: z.string().optional().or(z.literal("")),
  travelEndDate: z.string().optional().or(z.literal("")),
  datesFlexible: z.boolean(),
  adults: z.coerce.number().int().min(1, "At least one adult").max(99),
  children: z.coerce.number().int().min(0).max(99),
  infants: z.coerce.number().int().min(0).max(20),
  budget: z.string().trim().max(120).optional().or(z.literal("")),
  requirements: z.string().trim().max(1000).optional().or(z.literal("")),
  leadSource: z.enum(["website", "whatsapp", "phone", "email", "referral", "walk-in"]),
  assignedConsultantId: z.string().min(1, "Assign a consultant"),
  estimatedValue: z.coerce.number().min(0).max(100_000_000),
});
export type EnquiryForm = z.infer<typeof enquirySchema>;

export const taskSchema = z.object({
  title: z.string().trim().min(3, "Enter a task title"),
  type: z.enum(["follow-up-call", "send-quotation", "confirm-supplier", "collect-payment", "send-documents", "general"]),
  customerId: z.string().optional().or(z.literal("")),
  assignedToId: z.string().min(1, "Assign this task"),
  dueDate: z.string().min(1, "Pick a due date"),
  dueTime: z.string().min(1, "Pick a time"),
  priority: z.enum(["low", "medium", "high"]),
});
export type TaskForm = z.infer<typeof taskSchema>;

export const paymentSchema = z.object({
  amount: z.coerce.number().positive("Enter an amount"),
  method: z.enum(["mpesa", "bank-transfer", "card", "cash"]),
  reference: z.string().trim().min(2, "Enter a reference"),
});
export type PaymentForm = z.infer<typeof paymentSchema>;
