import fs from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: path.resolve(process.cwd(), ".env.local") });

const bucketName = "quiz-files";
const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/002_question_file_fields.sql",
);
const allowedMimeTypes = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
];
const fileSizeLimit = 10 * 1024 * 1024;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const managementAccessToken = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SUPABASE_PROJECT_REF ?? getProjectRef(supabaseUrl);

if (!supabaseUrl || !supabaseSecretKey) {
  console.error(
    "Missing Supabase setup environment variables. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  await applyQuestionFileMigrationIfNeeded();
  await ensureQuizFilesBucket();

  console.log("Supabase file setup completed.");
}

async function applyQuestionFileMigrationIfNeeded() {
  const alreadyApplied = await hasQuestionFileColumns();

  if (alreadyApplied) {
    console.log("Migration 002_question_file_fields.sql already applied. Skipping.");
    return;
  }

  if (!managementAccessToken || !projectRef) {
    throw new Error(
      "Migration is not applied yet. Set SUPABASE_ACCESS_TOKEN and, if needed, SUPABASE_PROJECT_REF in .env.local to apply SQL through the Supabase Management API.",
    );
  }

  const sql = await fs.readFile(migrationPath, "utf8");
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${managementAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: sql,
        read_only: false,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to apply migration through Supabase Management API. ${await getSafeResponseMessage(response)}`,
    );
  }

  const verified = await hasQuestionFileColumns();

  if (!verified) {
    throw new Error("Migration request completed, but question file columns were not verified.");
  }

  console.log("Migration 002_question_file_fields.sql applied.");
}

async function hasQuestionFileColumns() {
  const { error } = await supabase
    .from("quiz_sets")
    .select("question_file_path, question_file_mime_type, question_file_original_name")
    .limit(1);

  return !error;
}

async function ensureQuizFilesBucket() {
  const { data: bucket, error: getError } = await supabase.storage.getBucket(bucketName);
  const options = {
    public: true,
    allowedMimeTypes,
    fileSizeLimit,
  };

  if (bucket && !getError) {
    const { error: updateError } = await supabase.storage.updateBucket(bucketName, options);

    if (updateError) {
      throw new Error(`Failed to update ${bucketName} bucket settings: ${updateError.message}`);
    }

    console.log(`${bucketName} bucket already exists. Settings verified.`);
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(bucketName, options);

  if (createError) {
    if (isAlreadyExistsError(createError.message)) {
      console.log(`${bucketName} bucket already exists. Skipping creation.`);
      return;
    }

    throw new Error(`Failed to create ${bucketName} bucket: ${createError.message}`);
  }

  console.log(`${bucketName} bucket created.`);
}

function getProjectRef(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    const hostname = new URL(value).hostname;
    const [ref] = hostname.split(".");
    return ref || null;
  } catch {
    return null;
  }
}

function isAlreadyExistsError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("already") || normalized.includes("exists");
}

async function getSafeResponseMessage(response: Response) {
  const text = await response.text();

  if (!text) {
    return `Status ${response.status}.`;
  }

  try {
    const data = JSON.parse(text) as { message?: unknown; error?: unknown };
    const message =
      typeof data.message === "string"
        ? data.message
        : typeof data.error === "string"
          ? data.error
          : text;
    return `Status ${response.status}: ${message}`;
  } catch {
    return `Status ${response.status}: ${text.slice(0, 300)}`;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unknown Supabase file setup error.");
  process.exit(1);
});
