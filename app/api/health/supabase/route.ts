import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseSecretKey,
  getSupabaseUrl,
} from "@/lib/supabase/admin";
import { getSupabasePublishableKey } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SafeErrorSummary = {
  name: string;
  message: string;
  cause?: string;
};

type QueryCheck = {
  label: "secret" | "publishable";
  configured: boolean;
  clientCreated: boolean;
  queryOk: boolean;
  restFetchOk: boolean;
  restStatus?: number;
  table: {
    name: "quiz_sets";
    readable: boolean;
    sampleRowCount?: number;
  };
  error?: SafeErrorSummary;
};

export async function GET() {
  const supabaseUrl = getSupabaseUrl();
  const secretKey = getSupabaseSecretKey();
  const publishableKey = getSupabasePublishableKey();
  const envStatus = {
    supabaseUrlConfigured: Boolean(supabaseUrl),
    publishableKeyConfigured: Boolean(publishableKey),
    legacyAnonKeyConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    secretKeyConfigured: Boolean(secretKey),
    legacyServiceRoleKeyConfigured: Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
  };

  const secretCheck = await checkQuizSetsRead({
    label: "secret",
    supabaseUrl,
    supabaseKey: secretKey,
  });
  const publishableCheck = await checkQuizSetsRead({
    label: "publishable",
    supabaseUrl,
    supabaseKey: publishableKey,
  });
  const ok = secretCheck.queryOk || publishableCheck.queryOk;

  return Response.json(
    {
      ok,
      env: envStatus,
      checks: {
        secret: secretCheck,
        publishable: publishableCheck,
      },
      diagnosis: buildDiagnosis(secretCheck, publishableCheck),
    },
    { status: ok ? 200 : 500 },
  );
}

async function checkQuizSetsRead({
  label,
  supabaseUrl,
  supabaseKey,
}: {
  label: "secret" | "publishable";
  supabaseUrl: string | undefined;
  supabaseKey: string | undefined;
}): Promise<QueryCheck> {
  const base: QueryCheck = {
    label,
    configured: Boolean(supabaseUrl && supabaseKey),
    clientCreated: false,
    queryOk: false,
    restFetchOk: false,
    table: {
      name: "quiz_sets",
      readable: false,
    },
  };

  if (!supabaseUrl || !supabaseKey) {
    return {
      ...base,
      error: {
        name: "ConfigurationError",
        message: `${label} Supabase environment variables are not configured.`,
      },
    };
  }

  try {
    const restCheck = await checkRestEndpoint(supabaseUrl, supabaseKey);
    const supabase = createDiagnosticClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from("quiz_sets")
      .select("id")
      .limit(1);

    if (error) {
      return {
        ...base,
        clientCreated: true,
        restFetchOk: restCheck.ok,
        restStatus: restCheck.status,
        error: {
          name: error.name ?? "SupabaseQueryError",
          message: error.message,
          cause: restCheck.error?.cause,
        },
      };
    }

    return {
      ...base,
      clientCreated: true,
      queryOk: true,
      restFetchOk: restCheck.ok,
      restStatus: restCheck.status,
      table: {
        name: "quiz_sets",
        readable: true,
        sampleRowCount: data?.length ?? 0,
      },
    };
  } catch (error) {
    return {
      ...base,
      clientCreated: true,
      error: summarizeError(error),
    };
  }
}

async function checkRestEndpoint(
  supabaseUrl: string,
  supabaseKey: string,
): Promise<{
  ok: boolean;
  status?: number;
  error?: SafeErrorSummary;
}> {
  try {
    const url = new URL("/rest/v1/quiz_sets", supabaseUrl);
    url.searchParams.set("select", "id");
    url.searchParams.set("limit", "1");

    const response = await fetch(url, {
      headers: {
        apikey: supabaseKey,
        authorization: `Bearer ${supabaseKey}`,
      },
    });

    return {
      ok: response.ok,
      status: response.status,
    };
  } catch (error) {
    return {
      ok: false,
      error: summarizeError(error),
    };
  }
}

function createDiagnosticClient(
  supabaseUrl: string,
  supabaseKey: string,
): SupabaseClient {
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: (input, init) => fetch(input, init),
    },
  });
}

function summarizeError(error: unknown): SafeErrorSummary {
  if (!(error instanceof Error)) {
    return {
      name: "UnknownError",
      message: "Unknown Supabase query error.",
    };
  }

  return {
    name: error.name,
    message: error.message,
    cause: summarizeCause(error.cause),
  };
}

function summarizeCause(cause: unknown): string | undefined {
  if (!cause) {
    return undefined;
  }

  if (cause instanceof Error) {
    return `${cause.name}: ${cause.message}`;
  }

  if (typeof cause === "string") {
    return cause;
  }

  return "Non-Error cause object";
}

function buildDiagnosis(secretCheck: QueryCheck, publishableCheck: QueryCheck) {
  if (secretCheck.queryOk) {
    return "Secret/service key query succeeded.";
  }

  if (publishableCheck.queryOk) {
    return "Publishable/anon key query succeeded, but secret/service key query failed.";
  }

  if (secretCheck.restFetchOk || publishableCheck.restFetchOk) {
    return "Direct REST fetch reached Supabase, but Supabase client query failed.";
  }

  if (!secretCheck.configured && !publishableCheck.configured) {
    return "Supabase keys are not configured.";
  }

  if (secretCheck.error?.message === publishableCheck.error?.message) {
    return "Both Supabase query modes failed with the same safe error summary.";
  }

  return "Both Supabase query modes failed. Compare the safe error summaries for secret and publishable checks.";
}
