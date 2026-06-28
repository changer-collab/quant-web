import { useState } from 'react';
import type { StrategyRow, StrategyCategory, UiCopy, LanguageCode } from '../appData';
import s from '../styles/strategy-page.module.css';

/** 分类显示顺序 */
const CATEGORY_ORDER: StrategyCategory[] = ['factor_based', 'non_factor', 'transitional'];

/** 子分类颜色映射 */
function subcategoryClass(cat: string, styles: Record<string, string>): string {
  if (cat === 'factor_based') return styles.subcategoryTagFactor;
  if (cat === 'transitional') return styles.subcategoryTagTransitional;
  return styles.subcategoryTagNonfactor;
}

/** 分类图标 CSS 类映射 */
function categoryIconClass(cat: string, styles: Record<string, string>): string {
  if (cat === 'factor_based') return styles.categoryIconFactor;
  if (cat === 'transitional') return styles.categoryIconTransitional;
  return styles.categoryIconNonFactor;
}

interface StrategyGridNewProps {
  strategies: StrategyRow[];
  onSelectStrategy: (strategy: StrategyRow) => void;
  onEnterWorkspace: (strategy: StrategyRow) => void;
  ui: UiCopy;
  language: LanguageCode;
}

export function StrategyGridNew({
  strategies,
  onSelectStrategy,
  onEnterWorkspace,
  ui,
  language,
}: StrategyGridNewProps) {
  const [collapsedSubcategories, setCollapsedSubcategories] = useState<Set<string>>(new Set());

  function toggleSubcategory(key: string) {
    setCollapsedSubcategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  // 按 category 分组
  const categorized = CATEGORY_ORDER.map((cat) => {
    const items = strategies.filter((s) => (s.category ?? 'non_factor') === cat);
    // 按 subcategory 分组（无 subcategory 归入 'other'）
    const subGroups = new Map<string, StrategyRow[]>();
    for (const s of items) {
      const sub = s.subcategory ?? 'other';
      if (!subGroups.has(sub)) subGroups.set(sub, []);
      subGroups.get(sub)!.push(s);
    }
    return { category: cat, items, subGroups };
  });

  function subcategoryLabel(sub: string): string {
    if (sub === 'other') return language === 'zh' ? '未分类' : 'Uncategorized';
    const label = (ui.strategySubcategoryLabels as Record<string, string>)[sub];
    return label ?? sub;
  }

  function categoryLabel(cat: string): string {
    const label = (ui.strategyCategoryLabels as Record<string, string>)[cat];
    return label ?? cat;
  }

  if (strategies.length === 0) {
    return <p className={s.empty}>{ui.emptyStrategies}</p>;
  }

  return (
    <div>
      {categorized.map(({ category, items, subGroups }) =>
        items.length > 0 ? (
          <div className={s.categorySection} key={category}>
            <div className={s.categoryHeader}>
              <span className={`${s.categoryIcon} ${categoryIconClass(category, s)}`}>
                {category === 'factor_based' ? 'F' : category === 'transitional' ? 'T' : 'N'}
              </span>
              <span className={s.categoryTitle}>{categoryLabel(category)}</span>
              <span className={s.categoryCount}>{items.length}</span>
            </div>

            {Array.from(subGroups.entries()).map(([sub, groupItems]) => {
              const groupKey = `${category}::${sub}`;
              const isCollapsed = collapsedSubcategories.has(groupKey);

              return (
                <div className={s.subcategoryGroup} key={groupKey}>
                  <div
                    className={s.subcategoryHeader}
                    onClick={() => toggleSubcategory(groupKey)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleSubcategory(groupKey); }}
                  >
                    <span className={`${s.subcategoryToggle} ${isCollapsed ? '' : s.subcategoryToggleOpen}`}>
                      ▶
                    </span>
                    <span className={s.subcategoryLabel}>{subcategoryLabel(sub)}</span>
                    <span className={s.subcategoryCount}>{groupItems.length}</span>
                  </div>

                  {!isCollapsed && (
                    <div className={s.cardGrid}>
                      {groupItems.map((strategy) => (
                        <div
                          className={s.card}
                          key={strategy.id}
                          onClick={() => onSelectStrategy(strategy)}
                        >
                          <div className={s.cardName}>{strategy.name}</div>
                          <div className={s.cardMeta}>
                            <span className={`${s.subcategoryTag} ${subcategoryClass(category, s)}`}>
                              {subcategoryLabel(strategy.subcategory ?? 'other')}
                            </span>
                          </div>
                          {strategy.description && (
                            <p className={s.cardDesc}>{strategy.description}</p>
                          )}
                          <div className={s.cardAction}>
                            <button
                              className={s.workspaceButton}
                              disabled={!strategy.workflowReady}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (strategy.workflowReady) {
                                  onEnterWorkspace(strategy);
                                }
                              }}
                              type="button"
                            >
                              {ui.enterWorkspace}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null,
      )}
    </div>
  );
}
