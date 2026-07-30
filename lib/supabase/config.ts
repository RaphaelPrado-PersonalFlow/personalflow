function requiredEnvironmentVariable(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(
      `A variável ${name} não foi configurada. Verifique o arquivo .env.local.`,
    );
  }

  return value;
}

export function getSupabaseConfig() {
  return {
    url: requiredEnvironmentVariable(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    publishableKey: requiredEnvironmentVariable(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
  };
}
