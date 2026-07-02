import type { KeywordTileCategory, KeywordTileItem } from '../../data/types';

export interface NormalizedKeywordTile {
  text: string;
  category: KeywordTileCategory;
}

const SPLIT_PATTERN = /[；。！？、，;.!?,\n]+/u;
const MIN_PHRASE_LENGTH = 2;
const DEFAULT_MAX_ITEMS = 12;

const KEYWORDS: Record<Exclude<KeywordTileCategory, 'observation'>, string[]> = {
  assumption: ['假设', '基于', '前提', '默认', '充足'],
  limitation: ['未考虑', '不足', '限制', '缺少', '未纳入'],
  risk: ['风险', '亏损', '恶化', '冲击', '滑点', '回撤'],
};

function isValidCategory(category: unknown): category is KeywordTileCategory {
  return (
    category === 'assumption' ||
    category === 'limitation' ||
    category === 'risk' ||
    category === 'observation'
  );
}

export function splitKeywordText(text: string): string[] {
  const seen = new Set<string>();
  const phrases: string[] = [];

  for (const raw of text.split(SPLIT_PATTERN)) {
    const phrase = raw.trim();
    if (phrase.length < MIN_PHRASE_LENGTH || seen.has(phrase)) continue;
    seen.add(phrase);
    phrases.push(phrase);
  }

  return phrases;
}

export function classifyKeywordTile(text: string): KeywordTileCategory {
  if (KEYWORDS.limitation.some((keyword) => text.includes(keyword))) return 'limitation';
  if (KEYWORDS.risk.some((keyword) => text.includes(keyword))) return 'risk';
  if (KEYWORDS.assumption.some((keyword) => text.includes(keyword))) return 'assumption';
  return 'observation';
}

export function normalizeKeywordTiles({
  items,
  fallbackText,
  maxItems = DEFAULT_MAX_ITEMS,
}: {
  items?: KeywordTileItem[];
  fallbackText?: string;
  maxItems?: number;
}): NormalizedKeywordTile[] {
  if (maxItems <= 0) return [];

  const sourceItems: KeywordTileItem[] = Array.isArray(items)
    ? items
    : splitKeywordText(fallbackText ?? '').map((text) => ({ text }));

  const seen = new Set<string>();
  const normalized: NormalizedKeywordTile[] = [];

  for (const item of sourceItems) {
    if (!item || typeof item.text !== 'string') continue;

    const text = item.text.trim();
    if (text.length < MIN_PHRASE_LENGTH || seen.has(text)) continue;
    seen.add(text);
    normalized.push({
      text,
      category: isValidCategory(item.category) ? item.category : classifyKeywordTile(text),
    });
    if (normalized.length >= maxItems) break;
  }

  return normalized;
}
