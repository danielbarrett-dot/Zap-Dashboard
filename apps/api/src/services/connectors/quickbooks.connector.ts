import { SyncProvider, SyncMode } from "@prisma/client";

import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { decryptValue, encryptValue } from "../../lib/crypto.js";
import { mockQuickBooksPayload } from "./mock/mockData.js";
import type {
  NormalizedExpenseRecord,
  NormalizedInvoiceRecord,
  NormalizedPaymentRecord,
  QuickBooksSyncPayload
} from "./types.js";

type QuickBooksTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

const asString = (value: unknown) => (typeof value === "string" ? value : "");
const asNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getQuickBooksConnection = async () => {
  const existing = await prisma.integrationConnection.findUnique({
    where: {
      provider: SyncProvider.QUICKBOOKS
    }
  });

  if (existing) {
    return existing;
  }

  return prisma.integrationConnection.create({
    data: {
      provider: SyncProvider.QUICKBOOKS,
      mode: env.QUICKBOOKS_SYNC_MODE === "LIVE" ? SyncMode.LIVE : SyncMode.MOCK,
      realmId: env.QUICKBOOKS_REALM_ID,
      refreshTokenEncrypted: encryptValue(env.QUICKBOOKS_REFRESH_TOKEN),
      baseUrl: env.QUICKBOOKS_API_BASE_URL
    }
  });
};

const refreshQuickBooksToken = async (refreshToken: string) => {
  if (!env.QUICKBOOKS_CLIENT_ID || !env.QUICKBOOKS_CLIENT_SECRET) {
    throw new Error("QuickBooks live sync requires QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET");
  }

  const basicAuth = Buffer.from(
    `${env.QUICKBOOKS_CLIENT_ID}:${env.QUICKBOOKS_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(env.QUICKBOOKS_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  });

  if (!response.ok) {
    throw new Error(`QuickBooks token refresh failed with status ${response.status}`);
  }

  return (await response.json()) as QuickBooksTokenResponse;
};

const getQuickBooksAuth = async () => {
  const connection = await getQuickBooksConnection();
  const savedRefreshToken = decryptValue(connection.refreshTokenEncrypted);
  const savedAccessToken = decryptValue(connection.accessTokenEncrypted);
  const refreshToken = savedRefreshToken || env.QUICKBOOKS_REFRESH_TOKEN;
  const realmId = connection.realmId || env.QUICKBOOKS_REALM_ID;

  if (!refreshToken || !realmId) {
    throw new Error("QuickBooks live sync requires QUICKBOOKS_REFRESH_TOKEN and QUICKBOOKS_REALM_ID");
  }

  const tokenStillValid =
    savedAccessToken &&
    connection.tokenExpiresAt &&
    connection.tokenExpiresAt.getTime() > Date.now() + 60_000;

  if (tokenStillValid) {
    return {
      accessToken: savedAccessToken,
      realmId
    };
  }

  const refreshed = await refreshQuickBooksToken(refreshToken);

  await prisma.integrationConnection.update({
    where: {
      provider: SyncProvider.QUICKBOOKS
    },
    data: {
      mode: SyncMode.LIVE,
      accessTokenEncrypted: encryptValue(refreshed.access_token),
      refreshTokenEncrypted: encryptValue(refreshed.refresh_token || refreshToken),
      tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      realmId,
      baseUrl: env.QUICKBOOKS_API_BASE_URL,
      status: "CONNECTED"
    }
  });

  return {
    accessToken: refreshed.access_token,
    realmId
  };
};

const runQuickBooksQuery = async (
  accessToken: string,
  realmId: string,
  entity: "Invoice" | "Payment" | "Purchase" | "Bill" | "Account"
) => {
  const records: Record<string, unknown>[] = [];
  let startPosition = 1;

  while (true) {
    const statement = `select * from ${entity} startposition ${startPosition} maxresults 1000`;
    const url = new URL(`${env.QUICKBOOKS_API_BASE_URL}/v3/company/${realmId}/query`);
    url.searchParams.set("query", statement);

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`QuickBooks ${entity} query failed with status ${response.status}`);
    }

    const json = (await response.json()) as {
      QueryResponse?: {
        Invoice?: Record<string, unknown>[];
        Payment?: Record<string, unknown>[];
        Purchase?: Record<string, unknown>[];
        Bill?: Record<string, unknown>[];
        Account?: Record<string, unknown>[];
      };
    };

    const chunk = json.QueryResponse?.[entity] || [];
    records.push(...chunk);

    if (chunk.length < 1000) {
      break;
    }

    startPosition += 1000;
  }

  return records;
};

const extractInvoiceCustomerName = (record: Record<string, unknown>) => {
  const customerRef = record.CustomerRef as { name?: string } | undefined;
  return customerRef?.name || asString(record.CustomerMemo);
};

const mapInvoice = (record: Record<string, unknown>): NormalizedInvoiceRecord => {
  const totalAmount = asNumber(record.TotalAmt);
  const totalTax = asNumber((record.TxnTaxDetail as { TotalTax?: unknown } | undefined)?.TotalTax);
  const balance = asNumber(record.Balance);
  const customerRef = record.CustomerRef as { value?: string; name?: string } | undefined;

  return {
    quickBooksInvoiceId: asString(record.Id),
    invoiceNumber: asString(record.DocNumber || record.Id),
    customerName: extractInvoiceCustomerName(record),
    customerId: customerRef?.value || null,
    invoiceDate: asString(record.TxnDate || new Date().toISOString()),
    dueDate: asString(record.DueDate || ""),
    totalExVat: totalAmount - totalTax,
    vatAmount: totalTax,
    totalIncVat: totalAmount,
    balanceDue: balance,
    reference: asString(
      record.PrivateNote ||
        (record.CustomerMemo as { value?: string } | undefined)?.value ||
        record.DocNumber
    ),
    memo: asString((record.CustomerMemo as { value?: string } | undefined)?.value),
    paymentStatus:
      balance <= 0 ? "Paid" : balance < totalAmount ? "Partially Paid" : "Outstanding",
    createdAtQuickBooks: asString((record.MetaData as { CreateTime?: string } | undefined)?.CreateTime),
    updatedAtQuickBooks: asString((record.MetaData as { LastUpdatedTime?: string } | undefined)?.LastUpdatedTime),
    payload: record
  };
};

const mapPayment = (record: Record<string, unknown>): NormalizedPaymentRecord => {
  const lines = Array.isArray(record.Line) ? record.Line : [];
  const invoiceLinkedTxn = lines
    .flatMap((line) =>
      Array.isArray((line as { LinkedTxn?: unknown[] }).LinkedTxn)
        ? ((line as { LinkedTxn: unknown[] }).LinkedTxn as Array<{ TxnId?: string; TxnType?: string }>)
        : []
    )
    .find((txn) => txn.TxnType === "Invoice");

  return {
    quickBooksPaymentId: asString(record.Id),
    invoiceQuickBooksInvoiceId: invoiceLinkedTxn?.TxnId || null,
    amount: asNumber(record.TotalAmt),
    paymentDate: asString(record.TxnDate || new Date().toISOString()),
    paymentMethod: asString((record.PaymentMethodRef as { name?: string } | undefined)?.name || "Unknown")
  };
};

const extractExpenseAccount = (record: Record<string, unknown>) => {
  const lines = Array.isArray(record.Line) ? record.Line : [];
  const accountBasedLine = lines.find((line) => Boolean((line as { AccountBasedExpenseLineDetail?: unknown }).AccountBasedExpenseLineDetail)) as
    | { AccountBasedExpenseLineDetail?: { AccountRef?: { name?: string; value?: string } } }
    | undefined;

  return accountBasedLine?.AccountBasedExpenseLineDetail?.AccountRef?.name || "Unmapped expense";
};

const mapExpense = (record: Record<string, unknown>, fallbackEntity: "Purchase" | "Bill"): NormalizedExpenseRecord => {
  const vendor = record.VendorRef as { value?: string; name?: string } | undefined;
  const totalAmount = asNumber(record.TotalAmt);
  const totalTax = asNumber((record.TxnTaxDetail as { TotalTax?: unknown } | undefined)?.TotalTax);
  const accountName = extractExpenseAccount(record);

  return {
    quickBooksExpenseId: `${fallbackEntity.toLowerCase()}-${asString(record.Id)}`,
    supplierName: vendor?.name || "Unknown supplier",
    expenseDate: asString(record.TxnDate || new Date().toISOString()),
    accountName,
    accountType: fallbackEntity,
    category: accountName,
    dashboardCategory: accountName.toLowerCase().includes("material")
      ? "materials_direct_purchases"
      : "other_overheads",
    description: asString(record.PrivateNote || record.Memo),
    amountExVat: totalAmount - totalTax,
    vatAmount: totalTax,
    amountIncVat: totalAmount,
    paymentStatus: fallbackEntity === "Bill" ? asString(record.Balance) : "Paid",
    reference: asString(record.DocNumber || record.Id),
    linkedCustomerName: asString((record.CustomerRef as { name?: string } | undefined)?.name),
    createdAtQuickBooks: asString((record.MetaData as { CreateTime?: string } | undefined)?.CreateTime),
    updatedAtQuickBooks: asString((record.MetaData as { LastUpdatedTime?: string } | undefined)?.LastUpdatedTime),
    payload: record
  };
};

export const fetchQuickBooksSyncPayload = async (): Promise<QuickBooksSyncPayload> => {
  if (env.QUICKBOOKS_SYNC_MODE === "MOCK") {
    return mockQuickBooksPayload;
  }

  const { accessToken, realmId } = await getQuickBooksAuth();
  const [invoiceRows, paymentRows, purchaseRows, billRows] = await Promise.all([
    runQuickBooksQuery(accessToken, realmId, "Invoice"),
    runQuickBooksQuery(accessToken, realmId, "Payment"),
    runQuickBooksQuery(accessToken, realmId, "Purchase"),
    runQuickBooksQuery(accessToken, realmId, "Bill")
  ]);

  return {
    invoices: invoiceRows.map(mapInvoice).filter((invoice) => invoice.quickBooksInvoiceId),
    payments: paymentRows.map(mapPayment).filter((payment) => payment.quickBooksPaymentId),
    expenses: [
      ...purchaseRows.map((row) => mapExpense(row, "Purchase")),
      ...billRows.map((row) => mapExpense(row, "Bill"))
    ].filter((expense) => expense.quickBooksExpenseId)
  };
};
