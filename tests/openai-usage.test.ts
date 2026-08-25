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
  assert.match(route, /usageType: "design_generation"/);
  assert.match(route, /usageType: "preview_image"/);
  assert.match(route, /onPreviewImageUsage/);
});

test("Editor AI records usage with the authenticated user and owned project", () => {
  const generator = readFileSync(new URL("../lib/openai/site-generator.ts", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/ai/edit/route.ts", import.meta.url), "utf8");
  const editor = readFileSync(new URL("../components/editor/editor-shell.tsx", import.meta.url), "utf8");
  assert.match(generator, /editProjectNode[\s\S]*await recordUsage\(response, options\?\.onUsage\);/);
  assert.match(route, /usageType: "editor_ai"/);
  assert.match(route, /\.eq\("owner_id", user\.id\)/);
  assert.match(editor, /architecture: baseSource\.architecture, renderMetrics/);
  assert.match(editor, /UUID_PATTERN\.test\(projectId\)[\s\S]*\{ projectId \}/);
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

test("usage classification migration keeps all aggregates service-role only", () => {
  const migration = readFileSync(new URL("../supabase/migrations/20260824141714_classify_openai_usage_features.sql", import.meta.url), "utf8");
  assert.match(migration, /design_generation/);
  assert.match(migration, /editor_ai/);
  assert.match(migration, /preview_image/);
  assert.match(migration, /get_admin_openai_usage_by_feature/);
  assert.match(migration, /grant execute on function public\.get_admin_openai_usage_by_feature\(\) to service_role/);
  assert.match(migration, /where usage_type = 'design_generation'/);
});

test("admin usage page authorizes from server-managed app metadata", () => {
  const page = readFileSync(new URL("../app/admin/usage/page.tsx", import.meta.url), "utf8");
  assert.match(page, /applicationRoleFromAppMetadata/);
  assert.match(page, /!== "admin"\) notFound\(\)/);
  assert.match(page, /getAdminOpenAIUsage/);
  assert.match(page, /기능별 비용/);
  assert.match(page, /1회 평균/);
});
