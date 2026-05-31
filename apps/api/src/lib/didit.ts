const DIDIT_API_BASE =
  process.env.DIDIT_API_BASE_URL || "https://verification.didit.me";

export type DiditCreateSessionResponse = {
  session_id: string;
  url: string;
  session_token?: string;
  vendor_data?: string | null;
  status?: string;
};

export type DiditSessionDecision = {
  session_id?: string;
  status?: string;
  vendor_data?: string | null;
  decision?: {
    id_verifications?: Array<{
      full_name?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      date_of_birth?: string | null;
      document_number?: string | null;
      nationality?: string | null;
    }>;
  };
};

function diditApiKey(): string {
  const key = process.env.DIDIT_API_KEY?.trim();
  if (!key) {
    throw new Error("DIDIT_API_KEY is not configured");
  }
  return key;
}

export function diditWorkflowId(): string {
  const id = process.env.DIDIT_WORKFLOW_ID?.trim();
  if (!id) {
    throw new Error("DIDIT_WORKFLOW_ID is not configured");
  }
  return id;
}

export async function createDiditSession(params: {
  vendorData: string;
  callbackUrl?: string;
  contactEmail?: string | null;
  expectedFullName?: string | null;
}): Promise<DiditCreateSessionResponse> {
  const body: Record<string, unknown> = {
    workflow_id: diditWorkflowId(),
    vendor_data: params.vendorData,
  };

  if (params.callbackUrl) {
    body.callback = params.callbackUrl;
  }

  if (params.contactEmail) {
    body.contact_details = { email: params.contactEmail };
  }

  if (params.expectedFullName?.trim()) {
    body.expected_details = { full_name: params.expectedFullName.trim() };
  }

  const res = await fetch(`${DIDIT_API_BASE}/v3/session/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": diditApiKey(),
    },
    body: JSON.stringify(body),
  });

  const payload = (await res.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  if (!res.ok) {
    const detail =
      (payload.detail as string) ||
      (payload.message as string) ||
      (payload.error as string) ||
      res.statusText;
    throw new Error(`Didit create session failed: ${detail}`);
  }

  const sessionId = String(payload.session_id ?? "");
  const url = String(payload.url ?? "");
  if (!sessionId || !url) {
    throw new Error("Didit create session returned an incomplete response");
  }

  return {
    session_id: sessionId,
    url,
    session_token:
      typeof payload.session_token === "string"
        ? payload.session_token
        : undefined,
    vendor_data:
      typeof payload.vendor_data === "string" ? payload.vendor_data : null,
    status: typeof payload.status === "string" ? payload.status : undefined,
  };
}

export async function fetchDiditSessionDecision(
  sessionId: string,
): Promise<DiditSessionDecision> {
  const res = await fetch(
    `${DIDIT_API_BASE}/v3/session/${encodeURIComponent(sessionId)}/decision/`,
    {
      headers: { "x-api-key": diditApiKey() },
    },
  );

  const payload = (await res.json().catch(() => ({}))) as DiditSessionDecision &
    Record<string, unknown>;

  if (!res.ok) {
    const detail =
      (payload as Record<string, unknown>).detail ||
      (payload as Record<string, unknown>).message ||
      res.statusText;
    throw new Error(`Didit decision fetch failed: ${String(detail)}`);
  }

  return payload;
}

export function mapDiditStatusToKyc(status: string | undefined): string {
  const normalized = (status ?? "").trim().toLowerCase();
  switch (normalized) {
    case "approved":
      return "approved";
    case "declined":
      return "declined";
    case "in review":
    case "in_review":
      return "in_review";
    case "in progress":
    case "in_progress":
    case "not started":
    case "not_started":
      return "in_progress";
    case "abandoned":
      return "abandoned";
    case "expired":
    case "kyc expired":
      return "expired";
    case "resubmitted":
      return "in_progress";
    default:
      return "in_progress";
  }
}

export function extractVerifiedIdentity(decision?: DiditSessionDecision["decision"]): {
  legalName: string | null;
  dateOfBirth: string | null;
} {
  const idv = decision?.id_verifications?.[0];
  if (!idv) return { legalName: null, dateOfBirth: null };

  const legalName =
    idv.full_name?.trim() ||
    [idv.first_name, idv.last_name].filter(Boolean).join(" ").trim() ||
    null;

  const dateOfBirth = idv.date_of_birth?.trim() || null;
  return { legalName, dateOfBirth };
}
