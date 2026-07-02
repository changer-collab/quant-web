import type { ReactNode } from 'react';
import s from '../../styles/factor-report-section.module.css';

interface FactorReportSectionProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function FactorReportSection({
  title,
  subtitle,
  children,
  defaultOpen = true,
  className,
}: FactorReportSectionProps) {
  return (
    <details open={defaultOpen} className={`${s.section} ${className ?? ''}`}>
      <summary className={s.summary}>
        <div>
          <h3 className={s.title}>{title}</h3>
          {subtitle && <p className={s.subtitle}>{subtitle}</p>}
        </div>
        <span className={s.chevron} />
      </summary>
      <div className={s.content}>{children}</div>
    </details>
  );
}
