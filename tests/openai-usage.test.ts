import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { estimateTextCostUsd, usageEventFromImageResponse, usageEventFromResponse } from "../lib/openai/usage.ts";
import { openAIUsageActorType } from "../lib/auth/roles.ts";

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

test("customer and admin fixtures are classified from trusted app metadata", () => {
  const customer = { id: "customer-user", app_metadata: { role: "user" } };
  const admin = { id: "admin-user", app_metadata: { role: "admin" } };
  assert.equal(openAIUsageActorType(customer.app_metadata), "customer");
  assert.equal(openAIUsageActorType(admin.app_metadata), "admin");
});

test("total fixture cost equals customer plus admin cost", () => {
  const fixtures = [
    { actorType: "customer", cost: 0.12 },
    { actorType: "admin", cost: 0.08 },
    { actorType: "customer", cost: 0.03 },
  ] as const;
  const customer = fixtures.filter((item) => item.actorType === "customer").reduce((sum, item) => sum + item.cost, 0);
  const admin = fixtures.filter((item) => item.actorType === "admin").reduce((sum, item) => sum + item.cost, 0);
  const total = fixtures.reduce((sum, item) => sum + item.cost, 0);
  assert.ok(Math.abs(total - (customer + admin)) < 1e-12);
});

test("gpt-image-2 usage produces a non-zero modality-aware cost", () => {
  const event = usageEventFromImageResponse({
    model: "gpt-image-2",
    imageCount: 1,
    usage: {
      input_tokens: 1500,
      input_tokens_details: {
        text_tokens: 1000,
        image_tokens: 500,
        cached_tokens: 300,
        cached_text_tokens: 200,
        cached_image_tokens: 100,
      },
      output_tokens: 2000,
      output_tokens_details: { image_tokens: 2000, text_tokens: 0 },
    },
  });
  assert.equal(event.estimatedImageCostUsd, 0.06765);
  assert.equal(event.estimatedCostUsd, event.estimatedImageCostUsd);
  assert.deepEqual(
    [event.textInputTokens, event.cachedTextInputTokens, event.imageInputTokens, event.cachedImageInputTokens, event.imageOutputTokens],
    [1000, 200, 500, 100, 2000],
  );
});

test("every successful design retry records an OpenAI usage event", () => {
  const generator = readFileSync(new URL("../lib/openai/site-generator.ts", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/ai/generate/route.ts", import.meta.url), "utf8");
  assert.match(generator, /for \(let attempt = 1; attempt <= 3;/);
  assert.match(generator, /for \(let attempt = 1; attempt <= 3;[\s\S]*runRecordedOpenAICall/);
  assert.match(route, /createGenerationUsageRecorder/);
  assert.match(route, /attachGenerationUsageToProject/);
  assert.match(route, /usageType: "design_generation"/);
  assert.match(route, /usageType: "preview_image"/);
  assert.match(route, /onPreviewImageUsage/);
});

test("planner, design, preview image, and editor AI all use the common recorded call", () => {
  const planner = readFileSync(new URL("../lib/openai/page-plan-generator.ts", import.meta.url), "utf8");
  const generator = readFileSync(new URL("../lib/openai/site-generator.ts", import.meta.url), "utf8");
  const image = readFileSync(new URL("../lib/openai/preview-image-generator.ts", import.meta.url), "utf8");
  const imageRepair = readFileSync(new URL("../lib/assets/image-repair.ts", import.meta.url), "utf8");
  const recordedCall = readFileSync(new URL("../lib/openai/recorded-call.ts", import.meta.url), "utf8");
  assert.match(planner, /responses\.create[\s\S]*usageFromResponse/);
  assert.equal((generator.match(/runRecordedOpenAICall\(/g) ?? []).length, 2);
  assert.match(image, /images\.generate[\s\S]*usageFromResponse/);
  assert.match(recordedCall, /NODE_ENV === "production"/);
  assert.match(recordedCall, /usageFromThrownValue/);
  assert.match(recordedCall, /OpenAIUsageRecordingError/);
  assert.match(imageRepair, /error\.name === "OpenAIUsageRecordingError"/);
});

test("retry fixtures add both request count and estimated cost", () => {
  const events = [
    usageEventFromResponse({ model: "gpt-5.6", usage: { input_tokens: 1000, output_tokens: 200 } }),
    usageEventFromResponse({ model: "gpt-5.6", usage: { input_tokens: 1200, output_tokens: 250 } }),
  ];
  assert.equal(events.reduce((sum, event) => sum + event.requestCount, 0), 2);
  assert.equal(events.reduce((sum, event) => sum + event.estimatedCostUsd, 0), 0.0178);
});

test("Editor AI records usage with the authenticated user and owned project", () => {
  const generator = readFileSync(new URL("../lib/openai/site-generator.ts", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/ai/edit/route.ts", import.meta.url), "utf8");
  const editor = readFileSync(new URL("../components/editor/editor-shell.tsx", import.meta.url), "utf8");
  assert.match(generator, /editProjectNode[\s\S]*runRecordedOpenAICall/);
  assert.match(route, /usageType: "editor_ai"/);
  assert.match(route, /\.eq\("owner_id", user\.id\)/);
  assert.match(editor, /architecture: baseSource\.architecture, pagePlan: baseSource\.pagePlan, renderMetrics/);
  assert.match(editor, /UUID_PATTERN\.test\(projectId\)[\s\S]*\{ projectId \}/);
});

test("actor and image-cost migration preserves service-role-only access and total decomposition", () => {
  const migration = readFileSync(new URL("../supabase/migrations/20260828112629_classify_openai_usage_actors_and_image_costs.sql", import.meta.url), "utf8");
  assert.match(migration, /actor_type text not null default 'customer'/);
  assert.match(migration, /actor_type in \('customer', 'admin'\)/);
  assert.match(migration, /text_input_tokens/);
  assert.match(migration, /cached_image_input_tokens/);
  assert.match(migration, /image_output_tokens/);
  assert.match(migration, /not an OpenAI invoice amount/);
  assert.match(migration, /sum\(estimated_cost_usd\).*as total_cost_usd/);
  assert.match(migration, /filter \(where actor_type = 'customer'\).*as customer_cost_usd/);
  assert.match(migration, /filter \(where actor_type = 'admin'\).*as admin_cost_usd/);
  assert.match(migration, /grant execute on function public\.get_admin_openai_usage_summary\(text\) to service_role/);
  assert.doesNotMatch(migration, /grant execute[\s\S]*to authenticated/);
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
  assert.match(page, /일반 사용자 비용/);
  assert.match(page, /관리자\/테스트 비용/);
});
