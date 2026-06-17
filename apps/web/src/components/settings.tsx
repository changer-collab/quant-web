import type { LanguageCode, UiCopy } from '../appData';
import settings from '../styles/settings.module.css';

export function LanguageSettings({
  language,
  onChange,
  ui,
}: {
  language: LanguageCode;
  onChange: (language: LanguageCode) => void;
  ui: UiCopy;
}) {
  return (
    <section className={settings.languagePanel}>
      <div>
        <h3>{ui.languageTitle}</h3>
        <p>{ui.languageDescription}</p>
      </div>
      <div className={settings.languageToggle} role="group" aria-label={ui.languageTitle}>
        {(['en', 'zh'] as const).map((option) => (
          <button
            className={`${settings.languageButton} ${language === option ? settings.languageButtonActive : ''}`}
            data-testid={`language-${option}`}
            key={option}
            onClick={() => onChange(option)}
            type="button"
          >
            {option === 'en' ? 'English' : '中文'}
          </button>
        ))}
      </div>
    </section>
  );
}
