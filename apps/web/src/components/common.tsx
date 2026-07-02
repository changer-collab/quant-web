import type { Metric, PageSection } from '../appData';
import hero from '../styles/hero.module.css';
import infoPanelStyles from '../styles/info-panel.module.css';

export function MetricCard({ metric }: { metric: Metric }) {
  const toneClass =
    metric.tone === 'good'
      ? hero.metricGood
      : metric.tone === 'warn'
        ? hero.metricWarn
        : hero.metricInfo;
  return (
    <article className={`${hero.metric} ${toneClass}`}>
      <span className={hero.metricLabel}>{metric.label}</span>
      <strong className={hero.metricValue}>{metric.value}</strong>
    </article>
  );
}

export function InfoPanel({ section }: { section: PageSection }) {
  return (
    <section className={infoPanelStyles.infoPanel}>
      <h3>{section.title}</h3>
      <div className={infoPanelStyles.chipRow}>
        {section.items.map((item) => (
          <span className={infoPanelStyles.chip} key={item}>
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}
