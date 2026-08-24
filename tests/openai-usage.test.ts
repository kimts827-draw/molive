import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { estimateTextCostUsd, usageEventFromResponse } from "../lib/openai/usage.ts";

test("OpenAI cost separates uncached, cached, cache-write, and output tokens", () => {
  const cost = estimateTextCostUsd({
    model: "gpt-5.6",
    inputTokens: 1_000_000,
    cachedInputTokens: 100_000,
    cacheWriteInputTokens: 200_000,
    outputTokens: 100_000,
  });
  assert.equal(cost, 5.84);
});

test("response usage is normalized without prompt or credential fields", () => {
  const event = usageEventFromResponse({
    model: "gpt-5.6-sol-2026-08-21",
    usage: {
      input_tokens: 1200,
      input_tokens_details: { cached_tokens: 200, cache_write_tokens: 100 },
      output_tokens: 300,
    },
  });
  assert.deepEqual({ input: event.inputTokens, cached: event.cachedInputTokens, output: event.outputTokens, requests: event.requestCount }, { input: 1200, cached: 200, output: 300, requests: 1 });
  assert.doesNotMatch(JSON.stringify(event), /prompt|api.?key|secret/i);
});

test("every successful design retry records an OpenAI usage event", () => {
  const generator = readFileSync(new URL("../lib/openai/site-generator.ts", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/ai/generate/route.ts", import.meta.url), "utf8");
  assert.match(generator, /for \(let attempt = 1; attempt <= 3;/);
  assert.match(generator, /await recordUsage\(response, options\?\.onUsage\);/);
  assert.match(route, /createGenerationUsageRecorder/);
  assert.match(route, /attachGenerationUsageToProject/);
});

test("usage migration is service-role only and provides admin aggregates", () => {
  const migration = readFileSync(new URL("../supabase/migrations/20260824133314_openai_generation_usage.sql", import.meta.url), "utf8");
  assert.match(migration, /create table public\.openai_usage_events/);
  assert.match(migration, /alter table public\.openai_usage_events enable row level security/);
  assert.match(migration, /revoke all on public\.openai_usage_events from public, anon, authenticated/);
  assert.match(migration, /grant all on public\.openai_usage_events to service_role/);
  assert.match(migration, /get_admin_openai_usage_summary/);
  assert.match(migration, /get_admin_recent_openai_usage/);
  assert.doesNotMatch(migration, /prompt|api_key|secret_key/i);
});

test("admin usage page authorizes from server-managed app metadata", () => {
  const page = readFileSync(new URL("../app/admin/usage/page.tsx", import.meta.url), "utf8");
  assert.match(page, /applicationRoleFromAppMetadata/);
  assert.match(page, /!== "admin"\) notFound\(\)/);
  assert.match(page, /getAdminOpenAIUsage/);
});
