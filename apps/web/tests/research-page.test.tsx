import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ResearchPage } from '../src/components/research-page';
import { getResearchCopy } from '../src/appData';

const getDetail = vi.fn();
const save = vi.fn();
const finish = vi.fn();
const addIdea = vi.fn();
const exclude = vi.fn();
const assign = vi.fn();

vi.mock('../src/hooks/useResearchSessions', () => ({
  useResearchSessions: () => ({
    sessions: [
      {
        id: 'rs-1',
        strategy: 'dual_ma',
        title: '双均线研究',
        status: 'collecting',
        candidate: {
          goal: '', initialHypothesis: '', implementationChanges: '', experiments: '',
          currentConclusion: '', failedAttempts: '', learnings: '', openQuestions: '',
        },
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    unassignedEvents: [{ id: 're-unassigned', eventType: 'git_commit', dedupeKey: 'git:a', payload: { message: '调整研究导航' }, occurredAt: 1 }],
    loading: false,
    getDetail,
    save,
    finish,
    addIdea,
    exclude,
    assign,
  }),
}));

describe('ResearchPage', () => {
  it('编辑候选并结束当前研究过程', async () => {
    const detail = {
      session: {
        id: 'rs-1', strategy: 'dual_ma', title: '双均线研究', status: 'collecting' as const,
        candidate: {
          goal: '', initialHypothesis: '', implementationChanges: '', experiments: '',
          currentConclusion: '', failedAttempts: '', learnings: '', openQuestions: '',
        },
        createdAt: 1, updatedAt: 1,
      },
      events: [{ id: 're-1', sessionId: 'rs-1', eventType: 'manual_inspiration', dedupeKey: 'manual:1', payload: {}, occurredAt: 1 }],
    };
    getDetail.mockResolvedValue(detail);
    save.mockResolvedValue(detail.session);
    finish.mockResolvedValue({ ...detail.session, status: 'pending_review' });

    render(<ResearchPage copy={getResearchCopy('zh')} />);

    fireEvent.click(screen.getByRole('button', { name: /双均线研究/u }));
    await screen.findByDisplayValue('双均线研究');
    fireEvent.change(screen.getByLabelText('研究目标'), { target: { value: '验证趋势过滤' } });
    fireEvent.click(screen.getByRole('button', { name: '保存候选' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith('rs-1', expect.objectContaining({ candidate: expect.objectContaining({ goal: '验证趋势过滤' }) })));

    fireEvent.click(screen.getByRole('button', { name: '结束本轮研究' }));
    await waitFor(() => expect(finish).toHaveBeenCalledWith('rs-1'));
    expect(screen.getByText('待归类事件')).toBeDefined();
    expect(screen.getByText('调整研究导航')).toBeDefined();
  });
});
