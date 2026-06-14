import type { Metric, PageSection } from '../appData';
import hero from '../styles/hero.module.css';
import infoPanelStyles from '../styles/info-panel.module.css';
import chartStyles from '../styles/chart.module.css';

export function MetricCard({ metric }: { metric: Metric }) {
  const toneClass = metric.tone === 'good' ? hero.metricGood : metric.tone === 'warn' ? hero.metricWarn : hero.metricInfo;
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

export function ChartMockup({ ariaLabel }: { ariaLabel: string }) {
  const bars = ['34%', '48%', '42%', '61%', '55%', '76%', '69%', '82%', '74%', '90%'];

  return (
    <section className={chartStyles.chartPanel} aria-label={ariaLabel}>
      <div className={chartStyles.axis}>
        {bars.map((height) => (
          <i className={chartStyles.bar} key={height} style={{ height }} />
        ))}
      </div>
      <div className={chartStyles.chartLine} />
      <span className={`${chartStyles.tradeDot} ${chartStyles.buyDot}`} />
      <span className={`${chartStyles.tradeDot} ${chartStyles.sellDot}`} />
    </section>
  );
}
