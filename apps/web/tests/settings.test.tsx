import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageSettings } from '../src/components/settings';
import { getUiCopy } from '../src/appData';

describe('LanguageSettings', () => {
  it('renders language title and description', () => {
    const ui = getUiCopy('en');
    render(<LanguageSettings language="en" onChange={vi.fn()} ui={ui} />);
    expect(screen.getByText(ui.languageTitle)).toBeInTheDocument();
    expect(screen.getByText(ui.languageDescription)).toBeInTheDocument();
  });

  it('renders both language buttons', () => {
    const ui = getUiCopy('en');
    render(<LanguageSettings language="en" onChange={vi.fn()} ui={ui} />);
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('中文')).toBeInTheDocument();
  });

  it('marks active language button', () => {
    const ui = getUiCopy('en');
    const { container } = render(<LanguageSettings language="zh" onChange={vi.fn()} ui={ui} />);
    const activeButton = container.querySelector('[class*="languageButtonActive"]');
    expect(activeButton).toBeInTheDocument();
    expect(activeButton?.textContent).toBe('中文');
  });

  it('calls onChange when a language button is clicked', () => {
    const ui = getUiCopy('en');
    const onChange = vi.fn();
    render(<LanguageSettings language="en" onChange={onChange} ui={ui} />);
    fireEvent.click(screen.getByText('中文'));
    expect(onChange).toHaveBeenCalledWith('zh');
  });
});
