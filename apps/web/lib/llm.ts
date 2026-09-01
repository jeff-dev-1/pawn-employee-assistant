import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

/**
 * The only file in this project allowed to import a model SDK.
 *
 * Two channels, both public cloud, both OpenAI-compatible:
 *   portkey - every vendor behind one gateway, which is where observability, cost
 *             attribution, guardrails and retries live.
 *   direct  - straight to the vendor. Fewer moving parts, and none of the above.
 *
 * Because both speak the same protocol this is one factory with a different baseURL and
 * headers, not two implementations. Switching is configuration, never code - and `git diff`
 * is what proves it.
 */

export type Channel = 'portkey' | 'direct';

export function activeChannel(): Channel {
  const value = process.env.LLM_PROVIDER ?? 'portkey';
  if (value !== 'portkey' && value !== 'direct') {
    throw new Error(`LLM_PROVIDER must be "portkey" or "direct", got "${value}"`);
  }
  return value;
}

/** A missing key fails here, naming the variable - not as a network timeout 30s later. */
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for LLM_PROVIDER=${activeChannel()}`);
  return value;
}

type Vendor = {
  slug: string;
  baseURL: string;
  apiKeyVar: string;
  virtualKeyVar: string;
  /**
   * Used only when this vendor is a fallback target, where each target names its own model
   * and MODEL_WRITER can no longer speak for all of them. Override per vendor with
   * MODEL_DEEPSEEK / MODEL_MOONSHOT / MODEL_QWEN. deepseek and moonshot are measured; qwen
   * is the vendor's documented default and nothing here has called it.
   */
  model: string;
};

const VENDORS: Record<string, Vendor> = {
  deepseek: {
    slug: 'deepseek',
    baseURL: 'https://api.deepseek.com/v1',
    apiKeyVar: 'DEEPSEEK_API_KEY',
    virtualKeyVar: 'PORTKEY_VK_DEEPSEEK',
    model: 'deepseek-chat',
  },
  moonshot: {
    slug: 'moonshot',
    baseURL: 'https://api.moonshot.cn/v1',
    apiKeyVar: 'MOONSHOT_API_KEY',
    virtualKeyVar: 'PORTKEY_VK_MOONSHOT',
    model: 'kimi-k3',
  },
  qwen: {
    slug: 'dashscope',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKeyVar: 'DASHSCOPE_API_KEY',
    virtualKeyVar: 'PORTKEY_VK_QWEN',
    model: 'qwen-plus',
  },
};

/** The vendor a role is configured for, exported so scripts can probe each role's path. */
export function vendorFor(vendorVar: string): Vendor {
  return vendor(process.env[vendorVar] ?? 'deepseek');
}

function vendor(name: string): Vendor {
  const found = VENDORS[name];
  if (!found) throw new Error(`Unknown vendor "${name}". Known: ${Object.keys(VENDORS).join(', ')}`);
  return found;
}

/**
 * The failures worth trying another vendor for. Everything not on this list is the vendor
 * answering correctly, and a wrong answer does not get better on a second vendor.
 *
 * This list is the entire safety argument for the feature, because of what is NOT on it.
 * Portkey's default is to fall back on any non-2xx, and a guardrail denial is 446 - so a
 * fallback config written the obvious way sends the denied request to the next vendor and
 * serves the answer the guardrail just refused. Portkey documents that as a feature ("blocked
 * on this provider, try that one"). Here it is a hole: the guardrail is the demo. Naming the
 * retryable statuses is what closes it, and leaving 401 and 400 off is deliberate too - a bad
 * key or a malformed request is not transient, and retrying it just bills a second vendor.
 */
const RETRY_ON = [429, 500, 502, 503, 504];

/**
 * FALLBACK_VENDORS, e.g. "deepseek,moonshot": the gateway tries them in order. Unset, or a
 * list shorter than two, means no config and the single-vendor path below is unchanged -
 * every earlier prompt in the manual keeps working untouched.
 *
 * THE ROLE'S OWN VENDOR GOES FIRST. Without that line this feature quietly deletes the
 * planner/writer split: both roles would be handed the same target list in the same order,
 * PLANNER_VENDOR and WRITER_VENDOR would stop meaning anything, and the difference would be
 * invisible - the answers keep arriving, from the wrong model. A resilience feature is not
 * allowed to change where a request goes when nothing has failed.
 *
 * The guardrail moves when this is on. A config can only be named once, so the `pc-` config
 * slug that carries the guardrail cannot also carry the routing; the guardrail is attached
 * per target by its own `pg-` slug instead. That is why there are two variables.
 */
function fallbackConfig(preferred: Vendor, guarded: boolean): Record<string, unknown> | undefined {
  const listed = (process.env.FALLBACK_VENDORS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (listed.length < 2) return undefined;
  const preferredName = Object.keys(VENDORS).find((k) => VENDORS[k] === preferred);
  const names = preferredName
    ? [preferredName, ...listed.filter((n) => n !== preferredName)]
    : listed;

  const guardrail = guarded ? process.env.PORTKEY_GUARDRAIL : undefined;
  const targets = names.map((name) => {
    const target = vendor(name);
    const virtualKey = process.env[target.virtualKeyVar];
    return {
      // A virtual key keeps the vendor credential inside the gateway. Without one the key
      // travels in the config, which is the same key going to the same gateway as the
      // Authorization header below - no new exposure, but it is a header, so it is logged.
      ...(virtualKey
        ? { virtual_key: virtualKey }
        : { provider: target.slug, api_key: required(target.apiKeyVar) }),
      override_params: { model: process.env[`MODEL_${name.toUpperCase()}`] ?? target.model },
      ...(guardrail ? { input_guardrails: [guardrail] } : {}),
    };
  });
  return { strategy: { mode: 'fallback', on_status_codes: RETRY_ON }, targets };
}

function model(modelVar: string, vendorVar: string, fallbackModel: string, guarded: boolean) {
  const target = vendor(process.env[vendorVar] ?? 'deepseek');
  const modelId = process.env[modelVar] ?? fallbackModel;

  if (activeChannel() === 'direct') {
    return createOpenAICompatible({
      name: 'direct',
      baseURL: target.baseURL,
      apiKey: required(target.apiKeyVar),
      // Without this a streamed answer reports zero tokens, and every later cost
      // comparison silently becomes a comparison of two zeroes.
      includeUsage: true,
    }).chatModel(modelId);
  }

  const { url, headers, apiKey } = endpoint(target, guarded);
  return createOpenAICompatible({
    name: 'portkey',
    baseURL: url,
    headers,
    apiKey,
    includeUsage: true,
  }).chatModel(modelId);
}

/**
 * The request the active channel makes, exported so scripts/check-guardrail.ts probes the
 * same path the application uses instead of a hand-rolled imitation of it.
 *
 * A virtual key keeps the vendor credential inside the gateway and is the better posture;
 * without one the gateway forwards the vendor key we hold. A CONFIG is separate from both,
 * and it is where a guardrail is attached. Without one the gateway still applies the
 * account default - which works, and leaves nobody able to say which rule ran.
 */
export function endpoint(target = vendor(process.env.WRITER_VENDOR ?? 'deepseek'), guarded = true) {
  if (activeChannel() === 'direct') {
    return { url: target.baseURL, headers: {}, apiKey: required(target.apiKeyVar) };
  }

  const virtualKey = process.env[target.virtualKeyVar] ?? process.env.PORTKEY_VIRTUAL_KEY;
  const headers: Record<string, string> = { 'x-portkey-api-key': required('PORTKEY_API_KEY') };
  let apiKey: string | undefined;

  // A fallback config names its own providers and models per target, so the single-vendor
  // headers would be describing a vendor the request may not end up at.
  const routing = fallbackConfig(target, guarded);
  if (routing) {
    headers['x-portkey-config'] = JSON.stringify(routing);
    return { url: process.env.PORTKEY_BASE_URL ?? 'https://api.portkey.ai/v1', headers, apiKey };
  }

  if (virtualKey) {
    headers['x-portkey-virtual-key'] = virtualKey;
  } else {
    headers['x-portkey-provider'] = target.slug;
    apiKey = required(target.apiKeyVar);
  }
  // The config carries the guardrail, so withholding it is what "unguarded" means. Same
  // gateway, same vendor, same key: one variable.
  if (guarded && process.env.PORTKEY_CONFIG) headers['x-portkey-config'] = process.env.PORTKEY_CONFIG;

  return { url: process.env.PORTKEY_BASE_URL ?? 'https://api.portkey.ai/v1', headers, apiKey };
}

/** Emits structured tool-call plans. Judged on stable JSON, not on prose. */
export function planner(guarded = true) {
  return model('MODEL_PLANNER', 'PLANNER_VENDOR', 'deepseek-chat', guarded);
}

/** Writes the employee-facing answer. Judged on prose. */
export function writer(guarded = true) {
  return model('MODEL_WRITER', 'WRITER_VENDOR', 'deepseek-chat', guarded);
}
