import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "1yHpgE3k4d4KEdhk2Jhja6Ym4R1gFGlEJTU5Op9R5geQ";
const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
const serviceAccountKeyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
const syncSecret = process.env.MONTHLY_REPORTS_SYNC_SECRET; // Optional: for securing the endpoint

// Month name to number mapping
const monthMap: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function parseMonth(monthStr: string | null | undefined): number | null {
  if (!monthStr) return null;
  const normalized = monthStr.trim().toLowerCase();
  return monthMap[normalized] || null;
}

function parseYear(yearStr: string | null | undefined): number | null {
  if (!yearStr) return null;
  const year = parseInt(yearStr, 10);
  if (isNaN(year) || year < 2000 || year > 2100) return null;
  return year;
}

function cleanCompanyName(companyName: string | null | undefined): string | null {
  if (!companyName) return null;
  // Remove emojis and special Unicode characters, but keep letters, numbers, spaces, &, -, ., and @
  return companyName
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, "") // Emoji range
    .replace(/[\u{2600}-\u{26FF}]/gu, "") // Miscellaneous symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, "") // Dingbats
    .replace(/[\u{FE00}-\u{FE0F}]/gu, "") // Variation selectors
    .replace(/[\u{200D}]/gu, "") // Zero-width joiner
    .replace(/[^\w\s&.\-@]/g, "") // Remove any remaining special chars except allowed ones
    .replace(/\s+/g, " ") // Normalize multiple spaces to single space
    .trim();
}

async function getOrFindCompany(
  supabase: ReturnType<typeof createClient>,
  companyName: string,
) {
  const cleaned = cleanCompanyName(companyName);
  if (!cleaned) return null;

  const { data: exactMatch } = await supabase
    .from("companies")
    .select("id, name")
    .ilike("name", cleaned)
    .maybeSingle();

  if (exactMatch) return exactMatch;

  const { data: partialMatches } = await supabase
    .from("companies")
    .select("id, name")
    .ilike("name", `%${cleaned}%`)
    .limit(5);

  if (partialMatches && partialMatches.length > 0) {
    return partialMatches[0];
  }

  return null;
}

async function getGoogleSheetsClient() {
  let credentials: { client_email: string; private_key: string };

  // Option 1: Use JSON key file path
  if (serviceAccountKeyPath) {
    const fs = await import("fs");
    if (fs.existsSync(serviceAccountKeyPath)) {
      credentials = JSON.parse(
        fs.readFileSync(serviceAccountKeyPath, "utf-8"),
      );
    } else {
      throw new Error(`Key file not found: ${serviceAccountKeyPath}`);
    }
  }
  // Option 2: Use environment variables
  else if (serviceAccountEmail && serviceAccountKey) {
    credentials = {
      client_email: serviceAccountEmail,
      private_key: serviceAccountKey.replace(/\\n/g, "\n"),
    };
  } else {
    throw new Error(
      "Google Service Account credentials not found. " +
        "Set GOOGLE_SERVICE_ACCOUNT_KEY_PATH or GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    );
  }

  const auth = new google.auth.JWT(
    credentials.client_email,
    undefined,
    credentials.private_key,
    ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  );

  return google.sheets({ version: "v4", auth });
}

async function fetchSheetData() {
  const sheets = await getGoogleSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "A:Z",
  });

  const rows = response.data.values;
  if (!rows || rows.length < 2) {
    throw new Error("Sheet appears to be empty or has no data rows");
  }

  const headers = rows[0].map((h) => String(h).trim().toLowerCase());

  const colIndex = {
    timestamp: headers.findIndex((h) => h.includes("timestamp")),
    email: headers.findIndex((h) => h.includes("email")),
    company: headers.findIndex((h) => h.includes("company")),
    month: headers.findIndex((h) => h.includes("month")),
    year: headers.findIndex((h) => h.includes("year")),
    challengeTeam: headers.findIndex(
      (h) => h.includes("challenge team") || h.includes("major challenge team"),
    ),
    challengeProduct: headers.findIndex(
      (h) =>
        h.includes("challenge product") ||
        h.includes("major challenge product"),
    ),
    challengeSales: headers.findIndex(
      (h) =>
        h.includes("challenge sales") || h.includes("major challenge sales"),
    ),
    challengeMarketing: headers.findIndex(
      (h) =>
        h.includes("challenge marketing") ||
        h.includes("major challenge marketing"),
    ),
    challengeFinance: headers.findIndex(
      (h) =>
        h.includes("challenge finance") ||
        h.includes("major challenge finance"),
    ),
    challengeFundraise: headers.findIndex(
      (h) =>
        h.includes("challenge fundraise") ||
        h.includes("major challenge fundraise"),
    ),
  };

  if (colIndex.company === -1 || colIndex.month === -1 || colIndex.year === -1) {
    throw new Error("Missing required columns: Company, Month, or Year");
  }

  const dataRows: Array<{
    company: string;
    month: number | null;
    year: number | null;
    challengeTeam: string | null;
    challengeProduct: string | null;
    challengeSales: string | null;
    challengeMarketing: string | null;
    challengeFinance: string | null;
    challengeFundraise: string | null;
  }> = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    const getValue = (idx: number): string | null => {
      if (idx === -1 || idx >= row.length) return null;
      const val = row[idx];
      return val && val !== "" && val !== "TRUE" && val !== "FALSE"
        ? String(val).trim()
        : null;
    };

    const company = getValue(colIndex.company);
    const month = getValue(colIndex.month);
    const year = getValue(colIndex.year);

    if (!company || !month || !year) continue;

    dataRows.push({
      company,
      month: parseMonth(month),
      year: parseYear(year),
      challengeTeam: getValue(colIndex.challengeTeam),
      challengeProduct: getValue(colIndex.challengeProduct),
      challengeSales: getValue(colIndex.challengeSales),
      challengeMarketing: getValue(colIndex.challengeMarketing),
      challengeFinance: getValue(colIndex.challengeFinance),
      challengeFundraise: getValue(colIndex.challengeFundraise),
    });
  }

  return dataRows;
}

export async function POST(request: NextRequest) {
  // Optional: Check for sync secret
  if (syncSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${syncSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Missing Supabase credentials" },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    const rows = await fetchSheetData();

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of rows) {
      if (!row.month || !row.year) {
        skipped++;
        continue;
      }

      const company = await getOrFindCompany(supabase, row.company);
      if (!company) {
        skipped++;
        continue;
      }

      try {
        const { error } = await supabase.from("monthly_reports").upsert(
          {
            company_id: company.id,
            month: row.month,
            year: row.year,
            challenge_team: row.challengeTeam || null,
            challenge_product: row.challengeProduct || null,
            challenge_sales: row.challengeSales || null,
            challenge_marketing: row.challengeMarketing || null,
            challenge_finance: row.challengeFinance || null,
            challenge_fundraise: row.challengeFundraise || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "company_id,year,month" },
        );

        if (error) {
          errors++;
        } else {
          imported++;
        }
      } catch (err) {
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors,
      total: rows.length,
    });
  } catch (error) {
    console.error("Monthly reports sync error:", error);
    return NextResponse.json(
      {
        error: "Failed to sync monthly reports",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

