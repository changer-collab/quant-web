import type { JSX } from 'react';
import type { KeywordTileItem } from '../../data/types';
import { normalizeKeywordTiles, type NormalizedKeywordTile } from './keyword-tiles';
import styles from '@/styles/report-tables.module.css';

export interface KeywordTileGridProps {
  title?: string;
  items?: KeywordTileItem[];
  fallbackText?: string;
  maxItems?: number;
}

const CATEGORY_LABELS: Record<NormalizedKeywordTile['category'], string> = {
  assumption: '假设',
  limitation: '限制',
  risk: '风险',
  observation: '观察',
};

const CATEGORY_CLASSES: Record<NormalizedKeywordTile['category'], string> = {
  assumption: styles.keywordTileAssumption,
  limitation: styles.keywordTileLimitation,
  risk: styles.keywordTileRisk,
  observation: styles.keywordTileObservation,
};

export function KeywordTileGrid({ title, items, fallbackText, maxItems }: KeywordTileGridProps): JSX.Element | null {
  const tiles = normalizeKeywordTiles({ items, fallbackText, maxItems });

  if (!tiles.length) return null;

  return (
    <section className={styles.keywordTileSection}>
      {title ? <h4 className={styles.assessTitle}>{title}</h4> : null}
      <div className={styles.keywordTileGrid}>
        {tiles.map((tile) => (
          <article
            className={`${styles.keywordTile} ${CATEGORY_CLASSES[tile.category]}`}
            data-keyword-tile="true"
            key={`${tile.category}-${tile.text}`}
          >
            <span className={styles.keywordTileCategory}>{CATEGORY_LABELS[tile.category]}</span>
            <strong className={styles.keywordTileText}>{tile.text}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
