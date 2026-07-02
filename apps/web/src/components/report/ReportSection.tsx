import type { ReactNode } from 'react';
import section from '@/styles/report-section.module.css';

interface ReportSectionProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function ReportSection({
  title,
  subtitle,
  children,
  defaultOpen = true,
  className = '',
}: ReportSectionProps) {
  return (
    <details className={`${section.section} ${className}`} open={defaultOpen}>
      <summary className={section.summary}>
        <div>
          <h3 className={section.title}>{title}</h3>
          {subtitle && <p className={section.subtitle}>{subtitle}</p>}
        </div>
        <span className={section.chevron} aria-hidden="true" />
      </summary>
      <div className={section.content}>{children}</div>
    </details>
  );
}
