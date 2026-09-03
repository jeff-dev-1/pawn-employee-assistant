'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * Two locales, no library.
 *
 * The reference project ships nine through an i18n framework; this ships two through a flat
 * object, because the whole surface is one screen and a framework would be more code than the
 * strings it manages.
 *
 * What is NOT translated, and the rule is worth stating: model output, tool names, trace ids,
 * and everything inside the chain of thought. The trace exists to be compared against the
 * gateway's logs, and a translated `hr.find_employee` would make the UI disagree with them.
 * Localise the product; leave the evidence alone.
 */
export type Lang = 'en' | 'zh-Hant';

export const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'zh-Hant', label: '繁體中文' },
];

const EN = {
  'app.name': 'PAWN Assistant',
  'app.tagline':
    'One question, routed across HR, IT and company policy, answered from real records. Ask below, or pick one from the left.',
  'examples.title': 'Example questions',
  'ex.leave': 'Remaining leave',
  'ex.remote': 'Remote work',
  'ex.manager': 'Manager and tickets',
  'ex.systemPrompt': 'System prompt',
  'ex.impersonation': 'Manager impersonation',
  'ex.learnName': 'Learn the name',
  'ex.harvest': 'Harvest the team',
  'ex.pii': 'Repeat back PII',
  'input.placeholder': 'Type your message here…',
  'input.send': 'Ask',
  'status.planning': 'Deciding which records to consult…',
  'status.calling': 'Reading the records…',
  'status.writing': 'Composing the answer…',
  'trace.show': 'View chain of thought',
  'trace.hide': 'Hide chain of thought',
  'trace.blocked': 'blocked',
  'trace.reason': 'Reason',
  'trace.completed': 'Completed',
  'trace.failed': 'Failed',
  'trace.next': 'Next: call',
  'trace.atOnce': '— at once, not in sequence',
  'trace.noTool': 'No tool in the catalog can answer this.',
  'cost.calls': 'LLM call',
  'cost.unreported': 'not reported by the vendor',
  'cost.copy': 'Copy the answer',
  'mode.normal': 'Normal usage',
  'mode.risky': 'Risky usage',
  'mode.protected': 'Protected mode',
  'theme.system': 'System',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.title': 'Theme',
  'lang.title': 'Language',
} as const;

export type Key = keyof typeof EN;

const ZH: Partial<Record<Key, string>> = {
  'app.tagline':
    '一個問題，橫跨 HR、IT 與公司政策路由，從真實紀錄中作答。在下方提問，或從左側挑一個。',
  'examples.title': '範例問題',
  'ex.leave': '剩餘假期',
  'ex.remote': '遠距工作',
  'ex.manager': '主管與工單',
  'ex.systemPrompt': '系統提示詞',
  'ex.impersonation': '冒充主管',
  'ex.learnName': '取得姓名',
  'ex.harvest': '收割團隊資料',
  'ex.pii': '回讀個資',
  'input.placeholder': '在此輸入您的訊息…',
  'input.send': '送出',
  'status.planning': '正在決定要查閱哪些紀錄…',
  'status.calling': '正在讀取紀錄…',
  'status.writing': '正在組織答案…',
  'trace.show': '查看思考鏈',
  'trace.hide': '收合思考鏈',
  'trace.blocked': '已攔截',
  'trace.reason': '推理',
  'trace.completed': '已完成',
  'trace.failed': '失敗',
  'trace.next': '下一步：呼叫',
  'trace.atOnce': '— 同時發出，不是依序',
  'trace.noTool': '工具目錄中沒有任何工具能回答這個問題。',
  'cost.calls': '次模型呼叫',
  'cost.unreported': '廠商未回報用量',
  'cost.copy': '複製答案',
  'mode.normal': '一般使用',
  'mode.risky': '風險使用',
  'mode.protected': '受保護模式',
  'theme.system': '跟隨系統',
  'theme.light': '淺色',
  'theme.dark': '深色',
  'theme.title': '主題',
  'lang.title': '語言',
};

const DICT: Record<Lang, Partial<Record<Key, string>>> = { en: EN, 'zh-Hant': ZH };

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string }>({
  lang: 'en',
  setLang: () => undefined,
  t: (k) => EN[k],
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('en');

  useEffect(() => {
    const saved = localStorage.getItem('pawn-lang') as Lang | null;
    if (saved && DICT[saved]) setLang(saved);
  }, []);
  useEffect(() => {
    localStorage.setItem('pawn-lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  // Fall back to English rather than rendering the key: a missing translation should read as
  // an untranslated product, not as a broken one.
  const t = (k: Key) => DICT[lang][k] ?? EN[k];
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
