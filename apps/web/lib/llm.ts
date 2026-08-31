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

type Vendor = { slug: string; baseURL: string; apiKeyVar: string; virtualKeyVar: string };

const VENDORS: Record<string, Vendor> = {
  deepseek: {
    slug: 'deepseek',
    baseURL: 'https://api.deepseek.com/v1',
    apiKeyVar: 'DEEPSEEK_API_KEY',
    virtualKeyVar: 'PORTKEY_VK_DEEPSEEK',
  },
  moonshot: {
    slug: 'moonshot',
    baseURL: 'https://api.moonshot.cn/v1',
    apiKeyVar: 'MOONSHOT_API_KEY',
    virtualKeyVar: 'PORTKEY_VK_MOONSHOT',
  },
  qwen: {
    slug: 'dashscope',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKeyVar: 'DASHSCOPE_API_KEY',
    virtualKeyVar: 'PORTKEY_VK_QWEN',
  },
};

function vendor(name: string): Vendor {
  const found = VENDORS[name];
  if (!found) throw new Error(`Unknown vendor "${name}". Known: ${Object.keys(VENDORS).join(', ')}`);
  return found;
}

function model(modelVar: string, vendorVar: string, fallbackModel: string) {
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

  // A virtual key keeps the vendor credential inside the gateway and is the better posture.
  // Without one the gateway forwards the vendor key we hold, which still works.
  const virtualKey = process.env[target.virtualKeyVar] ?? process.env.PORTKEY_VIRTUAL_KEY;
  const headers: Record<string, string> = { 'x-portkey-api-key': required('PORTKEY_API_KEY') };
  let apiKey: string | undefined;

  if (virtualKey) {
    headers['x-portkey-virtual-key'] = virtualKey;
  } else {
    headers['x-portkey-provider'] = target.slug;
    apiKey = required(target.apiKeyVar);
  }

  return createOpenAICompatible({
    name: 'portkey',
    baseURL: process.env.PORTKEY_BASE_URL ?? 'https://api.portkey.ai/v1',
    headers,
    apiKey,
    includeUsage: true,
  }).chatModel(modelId);
}

/** Emits structured tool-call plans. Judged on stable JSON, not on prose. */
export function planner() {
  return model('MODEL_PLANNER', 'PLANNER_VENDOR', 'deepseek-chat');
}

/** Writes the employee-facing answer. Judged on prose. */
export function writer() {
  return model('MODEL_WRITER', 'WRITER_VENDOR', 'deepseek-chat');
}
