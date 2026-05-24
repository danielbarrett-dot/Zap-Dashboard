import { env } from "../../config/env.js";
import { mockServiceM8Payload } from "./mock/mockData.js";
import type {
  NormalizedJobRecord,
  NormalizedStaffRecord,
  NormalizedTimeEntryRecord,
  ServiceM8SyncPayload
} from "./types.js";

const asString = (value: unknown) => (typeof value === "string" ? value : "");
const asNullableString = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);
const asNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getMinutesFromActivity = (record: Record<string, unknown>) => {
  const directMinutes = asNumber(
    record.duration_minutes ?? record.duration ?? record.minutes ?? record.total_time_minutes
  );

  if (directMinutes > 0) {
    return directMinutes;
  }

  const start = asNullableString(record.start_date ?? record.start_time ?? record.timestamp);
  const end = asNullableString(record.end_date ?? record.end_time);

  if (start && end) {
    const milliseconds = new Date(end).getTime() - new Date(start).getTime();
    return Math.max(0, Math.round(milliseconds / 60000));
  }

  return 0;
};

const getAssignedStaff = (record: Record<string, unknown>) => {
  const rawValue = record.staff_names ?? record.assigned_staff ?? record.staff ?? [];

  if (Array.isArray(rawValue)) {
    return rawValue.map((entry) => asString(entry)).filter(Boolean);
  }

  return asString(rawValue)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const readConfiguredField = (record: Record<string, unknown>, fieldName: string) =>
  record[fieldName] ??
  (record.custom_fields as Record<string, unknown> | undefined)?.[fieldName] ??
  (record.customFields as Record<string, unknown> | undefined)?.[fieldName];

const getServiceM8Headers = () => {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json"
  };

  if (env.SERVICEM8_API_KEY) {
    headers["X-API-Key"] = env.SERVICEM8_API_KEY;
    return headers;
  }

  if (env.SERVICEM8_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${env.SERVICEM8_ACCESS_TOKEN}`;
    return headers;
  }

  throw new Error("Live ServiceM8 sync requires SERVICEM8_API_KEY or SERVICEM8_ACCESS_TOKEN");
};

const fetchAllPages = async (resource: string, filter?: string) => {
  const headers = getServiceM8Headers();
  let cursor = "-1";
  const rows: Record<string, unknown>[] = [];

  while (cursor) {
    const url = new URL(`${env.SERVICEM8_API_BASE_URL}/${resource}`);
    url.searchParams.set("cursor", cursor);

    if (filter) {
      url.searchParams.set("$filter", filter);
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`ServiceM8 request failed for ${resource}: ${response.status}`);
    }

    const data = (await response.json()) as Record<string, unknown>[];
    rows.push(...data);
    cursor = response.headers.get("x-next-cursor") || "";
  }

  return rows;
};

const mapJobRecord = (record: Record<string, unknown>): NormalizedJobRecord => ({
  serviceM8JobId: asString(record.uuid || record.id || record.job_id),
  jobName: asString(
    record.job_name || record.title || record.job_address || record.description || record.generated_job_id
  ),
  jobNumber: asNullableString(record.job_number || record.generated_job_id),
  customerName: asString(record.company_name || record.customer_name || record.client_name),
  customerId: asNullableString(record.company_uuid || record.customer_id || record.client_uuid),
  address: asNullableString(record.job_address || record.address),
  status: asString(record.status || record.job_status || "Unknown"),
  jobDate: asNullableString(record.date || record.job_date || record.create_date || new Date().toISOString()),
  completionDate: asNullableString(record.completion_date || record.completed_date || record.finish_date),
  createdAtServiceM8: asNullableString(record.create_date || record.created_at),
  updatedAtServiceM8: asNullableString(record.edit_date || record.updated_at),
  leadSource: asNullableString(readConfiguredField(record, env.SERVICEM8_LEAD_SOURCE_FIELD) || record.lead_source),
  jobType: asNullableString(readConfiguredField(record, env.SERVICEM8_JOB_TYPE_FIELD) || record.job_type),
  assignedStaff: getAssignedStaff(record),
  totalTimeMinutes: asNumber(record.total_time_minutes),
  materialsCostServiceM8: asNumber(readConfiguredField(record, env.SERVICEM8_MATERIALS_FIELD)),
  subcontractorCost: asNumber(readConfiguredField(record, env.SERVICEM8_SUBCONTRACTOR_FIELD) || record.subcontractor_cost),
  estimatedHours: asNumber(readConfiguredField(record, env.SERVICEM8_ESTIMATED_HOURS_FIELD) || record.estimated_hours),
  estimatedMaterials: asNumber(readConfiguredField(record, env.SERVICEM8_ESTIMATED_MATERIALS_FIELD) || record.estimated_materials),
  quotedValue: asNumber(record.quoted_value || record.quote_amount || record.total),
  payload: record
});

const mapTimeEntry = (record: Record<string, unknown>): NormalizedTimeEntryRecord => ({
  serviceM8BookingId: asString(record.uuid || record.id || record.booking_id),
  jobServiceM8JobId: asString(record.job_uuid || record.related_object_uuid || record.job_id),
  staffId: asNullableString(record.staff_uuid || record.staff_id),
  staffName: asString(record.staff_name || record.staff || record.created_by_staff_name || "Unknown Staff"),
  startTime: asNullableString(record.start_date || record.start_time || record.timestamp),
  endTime: asNullableString(record.end_date || record.end_time),
  durationMinutes: getMinutesFromActivity(record)
});

const mapStaff = (record: Record<string, unknown>): NormalizedStaffRecord => ({
  serviceM8StaffId: asString(record.uuid || record.id || record.staff_id),
  name: asString(record.first_name || record.name || record.staff_name),
  email: asNullableString(record.email),
  active: String(record.active ?? record.is_active ?? "1") !== "0",
  hourlyCostRate: asNumber(record.hourly_cost_rate)
});

export const fetchServiceM8SyncPayload = async (): Promise<ServiceM8SyncPayload> => {
  if (env.SERVICEM8_SYNC_MODE === "MOCK") {
    return mockServiceM8Payload;
  }

  const [jobs, activities, staff] = await Promise.all([
    fetchAllPages("job.json", "active eq 1"),
    fetchAllPages("jobactivity.json", "activity_was_scheduled eq 0"),
    fetchAllPages("staff.json")
  ]);

  return {
    jobs: jobs.map(mapJobRecord).filter((job) => job.serviceM8JobId && job.jobName),
    timeEntries: activities
      .map(mapTimeEntry)
      .filter((entry) => entry.serviceM8BookingId && entry.jobServiceM8JobId && entry.durationMinutes >= 0),
    staff: staff.map(mapStaff).filter((entry) => entry.serviceM8StaffId && entry.name)
  };
};
