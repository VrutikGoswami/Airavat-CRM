"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/forms/Field";
import { useWorkspace } from "@/lib/workspace";
import {
  customerSchema,
  enquirySchema,
  taskSchema,
  type CustomerForm,
  type EnquiryForm,
  type TaskForm,
} from "@/lib/schemas";
import {
  CUSTOMER_TYPE_LABELS,
  CONTACT_METHOD_LABELS,
  LEAD_SOURCE_LABELS,
  PRIORITY_LABELS,
  SERVICE_LABELS,
  TASK_TYPE_LABELS,
} from "@/lib/labels";
import { dateFromToday } from "@/lib/format";

type CreateKind = "customer" | "enquiry" | "task";

type ModalsValue = {
  openCreate: (kind: CreateKind | "quotation", presetCustomerId?: string) => void;
};

const ModalsContext = createContext<ModalsValue | null>(null);

export function useCreateModals(): ModalsValue {
  const ctx = useContext(ModalsContext);
  if (!ctx) throw new Error("useCreateModals must be used within CreateModalsProvider");
  return ctx;
}

export function CreateModalsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [kind, setKind] = useState<CreateKind | null>(null);
  const [presetCustomerId, setPresetCustomerId] = useState<string | undefined>();

  const openCreate: ModalsValue["openCreate"] = (k, customerId) => {
    if (k === "quotation") {
      router.push(customerId ? `/quotations/new?customer=${customerId}` : "/quotations/new");
      return;
    }
    setPresetCustomerId(customerId);
    setKind(k);
  };

  const close = () => setKind(null);

  return (
    <ModalsContext.Provider value={{ openCreate }}>
      {children}
      {kind === "customer" ? <NewCustomerModal onClose={close} /> : null}
      {kind === "enquiry" ? <NewEnquiryModal onClose={close} presetCustomerId={presetCustomerId} /> : null}
      {kind === "task" ? <NewTaskModal onClose={close} presetCustomerId={presetCustomerId} /> : null}
    </ModalsContext.Provider>
  );
}

const inputCls = "field";

// ---------------------------------------------------------------------------

function NewCustomerModal({ onClose }: { onClose: () => void }) {
  const { data, createCustomer } = useWorkspace();
  const router = useRouter();
  const consultants = data.users;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      type: "individual",
      preferredContact: "whatsapp",
      assignedConsultantId: consultants[1]?.id ?? consultants[0].id,
      email: "",
      preferences: "",
    },
  });

  const submit = handleSubmit((values) => {
    const id = createCustomer({
      name: values.name,
      whatsapp: values.whatsapp,
      email: values.email ?? "",
      type: values.type,
      assignedConsultantId: values.assignedConsultantId,
      preferredContact: values.preferredContact,
      preferences: values.preferences ?? "",
    });
    onClose();
    router.push(`/customers/${id}`);
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="New customer"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="new-customer-form" className="btn btn-primary hover:btn-primary-hover">
            Create customer
          </button>
        </>
      }
    >
      <form id="new-customer-form" onSubmit={submit} className="space-y-3.5">
        <Field label="Full name" error={errors.name?.message}>
          <input className={inputCls} {...register("name")} />
        </Field>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="WhatsApp / phone" error={errors.whatsapp?.message}>
            <input className={inputCls} placeholder="+254…" {...register("whatsapp")} />
          </Field>
          <Field label="Email" error={errors.email?.message} optional>
            <input className={inputCls} type="email" {...register("email")} />
          </Field>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Customer type" error={errors.type?.message}>
            <select className={inputCls} {...register("type")}>
              {Object.entries(CUSTOMER_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label="Preferred contact" error={errors.preferredContact?.message}>
            <select className={inputCls} {...register("preferredContact")}>
              {Object.entries(CONTACT_METHOD_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Assigned consultant" error={errors.assignedConsultantId?.message}>
          <select className={inputCls} {...register("assignedConsultantId")}>
            {consultants.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Traveller preferences" optional error={errors.preferences?.message}>
          <textarea className={inputCls} rows={2} {...register("preferences")} />
        </Field>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

function NewEnquiryModal({
  onClose,
  presetCustomerId,
}: {
  onClose: () => void;
  presetCustomerId?: string;
}) {
  const { data, createEnquiry } = useWorkspace();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EnquiryForm>({
    resolver: zodResolver(enquirySchema),
    defaultValues: {
      customerId: presetCustomerId ?? data.customers[0]?.id ?? "",
      service: "safari",
      datesFlexible: false,
      adults: 2,
      children: 0,
      infants: 0,
      leadSource: "website",
      assignedConsultantId: data.users[1]?.id ?? data.users[0].id,
      estimatedValue: 0,
      origin: "",
      destination: "",
      budget: "",
      requirements: "",
      travelStartDate: "",
      travelEndDate: "",
    },
  });

  const submit = handleSubmit((v) => {
    const id = createEnquiry({
      customerId: v.customerId,
      service: v.service,
      origin: v.origin ?? "",
      destination: v.destination,
      travelStartDate: v.travelStartDate ?? "",
      travelEndDate: v.travelEndDate ?? "",
      datesFlexible: v.datesFlexible,
      travellers: { adults: v.adults, children: v.children, infants: v.infants },
      budget: v.budget ?? "",
      requirements: v.requirements ?? "",
      leadSource: v.leadSource,
      assignedConsultantId: v.assignedConsultantId,
      estimatedValue: v.estimatedValue,
    });
    onClose();
    router.push(`/enquiries/${id}`);
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="New enquiry"
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="new-enquiry-form" className="btn btn-primary hover:btn-primary-hover">
            Create enquiry
          </button>
        </>
      }
    >
      <form id="new-enquiry-form" onSubmit={submit} className="space-y-3.5">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Customer" error={errors.customerId?.message}>
            <select className={inputCls} {...register("customerId")}>
              {data.customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Service" error={errors.service?.message}>
            <select className={inputCls} {...register("service")}>
              {Object.entries(SERVICE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Origin" optional error={errors.origin?.message}>
            <input className={inputCls} {...register("origin")} />
          </Field>
          <Field label="Destination" error={errors.destination?.message}>
            <input className={inputCls} {...register("destination")} />
          </Field>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Travel start" optional error={errors.travelStartDate?.message}>
            <input className={inputCls} type="date" {...register("travelStartDate")} />
          </Field>
          <Field label="Travel end" optional error={errors.travelEndDate?.message}>
            <input className={inputCls} type="date" {...register("travelEndDate")} />
          </Field>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-3">
          <Field label="Adults" error={errors.adults?.message}>
            <input className={inputCls} type="number" min={1} {...register("adults")} />
          </Field>
          <Field label="Children" error={errors.children?.message}>
            <input className={inputCls} type="number" min={0} {...register("children")} />
          </Field>
          <Field label="Infants" error={errors.infants?.message}>
            <input className={inputCls} type="number" min={0} {...register("infants")} />
          </Field>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Budget" optional error={errors.budget?.message}>
            <input className={inputCls} placeholder="e.g. KES 300,000" {...register("budget")} />
          </Field>
          <Field label="Estimated value (KES)" error={errors.estimatedValue?.message}>
            <input className={inputCls} type="number" min={0} {...register("estimatedValue")} />
          </Field>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Lead source" error={errors.leadSource?.message}>
            <select className={inputCls} {...register("leadSource")}>
              {Object.entries(LEAD_SOURCE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label="Assigned consultant" error={errors.assignedConsultantId?.message}>
            <select className={inputCls} {...register("assignedConsultantId")}>
              {data.users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Requirements" optional error={errors.requirements?.message}>
          <textarea className={inputCls} rows={2} {...register("requirements")} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-[var(--color-terracotta)]" {...register("datesFlexible")} />
          Dates are flexible
        </label>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

function NewTaskModal({
  onClose,
  presetCustomerId,
}: {
  onClose: () => void;
  presetCustomerId?: string;
}) {
  const { data, currentUser, createTask } = useWorkspace();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TaskForm>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      type: "follow-up-call",
      priority: "medium",
      assignedToId: currentUser.id,
      customerId: presetCustomerId ?? "",
      dueDate: dateFromToday(0),
      dueTime: "10:00",
      title: "",
    },
  });

  const submit = handleSubmit((v) => {
    createTask({
      title: v.title,
      type: v.type,
      customerId: v.customerId || undefined,
      assignedToId: v.assignedToId,
      dueAt: new Date(`${v.dueDate}T${v.dueTime}:00`).toISOString(),
      priority: v.priority,
    });
    onClose();
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="New task"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="new-task-form" className="btn btn-primary hover:btn-primary-hover">
            Create task
          </button>
        </>
      }
    >
      <form id="new-task-form" onSubmit={submit} className="space-y-3.5">
        <Field label="Title" error={errors.title?.message}>
          <input className={inputCls} {...register("title")} />
        </Field>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Type" error={errors.type?.message}>
            <select className={inputCls} {...register("type")}>
              {Object.entries(TASK_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label="Priority" error={errors.priority?.message}>
            <select className={inputCls} {...register("priority")}>
              {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Related customer" optional error={errors.customerId?.message}>
          <select className={inputCls} {...register("customerId")}>
            <option value="">— None —</option>
            {data.customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Due date" error={errors.dueDate?.message}>
            <input className={inputCls} type="date" {...register("dueDate")} />
          </Field>
          <Field label="Due time" error={errors.dueTime?.message}>
            <input className={inputCls} type="time" {...register("dueTime")} />
          </Field>
        </div>
        <Field label="Assigned to" error={errors.assignedToId?.message}>
          <select className={inputCls} {...register("assignedToId")}>
            {data.users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </Field>
      </form>
    </Modal>
  );
}
