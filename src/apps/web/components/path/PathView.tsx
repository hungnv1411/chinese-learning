'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Card, Progress } from '@/components/ui/Basics';
import { Button, IconButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { ApiClientError, apiFetch } from '@/lib/gateway/api-client';
import type { PathData } from '@/lib/path/path';
import {
  currentLesson,
  defaultStage,
  lockMessage,
  nodeOffset,
  type PathLesson,
  type PathStage,
  type PathUnit,
} from '@/lib/path/view';
import { vi } from '@/lib/strings/vi';

const L = vi.path;
type Load = { kind: 'loading' } | { kind: 'guest' } | { kind: 'error' } | { kind: 'ok'; data: PathData };

const shortName = (s: PathStage) => s.title.split(' · ')[0]!;

function percent(s: PathStage): number {
  const p = s.progress;
  if (p.completedVia) return 100;
  const frac = p.words ? (p.words.total ? p.words.mastered / p.words.total : 0) : p.units.total ? p.units.done / p.units.total : 0;
  return Math.round(frac * 100);
}

function summary(s: PathStage): string {
  const p = s.progress;
  if (p.completedVia === 'exam_skip') return L.examSkipDone;
  if (p.requires) return '';
  return L.stageSummary(
    L.unitsOf(p.units.done, p.units.total),
    p.words ? L.wordsOf(p.words.mastered, p.words.total) : '',
    p.chars ? L.charsOf(p.chars.mastered, p.chars.total) : '',
  );
}

function StageCard({ stage, stages, onPick }: { stage: PathStage; stages: PathStage[]; onPick: () => void }) {
  const done = stage.status === 'completed';
  const on = stage.status === 'available';
  const req = stage.progress.requires ? stages.find((x) => x.id === stage.progress.requires) : undefined;
  return (
    <button type="button" onClick={onPick} style={{ all: 'unset', display: 'block', cursor: 'pointer', width: '100%', minHeight: 44 }}>
      <Card className={`stage ${done ? 'done' : on ? 'on' : 'locked'}`}>
        <div className="row between">
          <b>{stage.title}</b>
          {done ? <Badge variant="success">{L.status.done}</Badge> : on ? <Badge variant="blue">{L.status.on}</Badge> : <Icon name="lock" />}
        </div>
        {on && <Progress small value={percent(stage)} label={stage.title} />}
        <p className="small muted">{req ? L.lock.stage(req.title) : summary(stage)}</p>
        {on && stage.finalExam !== 'none' && (
          <p className="small">
            <Badge variant="warn"><Icon name="award" />{L.certificate(shortName(stage))}</Badge> {L.certificateAfter}
          </p>
        )}
      </Card>
    </button>
  );
}

function SidePanels({ data, onPick, mobile }: { data: PathData; onPick: (id: PathStage['id']) => void; mobile?: boolean }) {
  const skip = data.skipExam ? data.stages.find((s) => s.id === data.skipExam) : undefined;
  const next = skip ? data.stages[data.stages.indexOf(skip) + 1] : undefined;
  return (
    <>
      <div className="stack-3">
        {data.stages.map((s) => (
          <StageCard key={s.id} stage={s} stages={data.stages} onPick={() => onPick(s.id)} />
        ))}
      </div>
      {skip && (
        mobile ? (
          <Link className="btn btn-secondary btn-block btn-sm" href={`/kiem-tra/${skip.id}?skip=1`}>
            {L.elsewhereCtaMobile(shortName(skip))}
          </Link>
        ) : (
          <Card soft className="stack-3">
            <h4>{L.elsewhereTitle(shortName(skip))}</h4>
            <p className="small">{L.elsewhereBody(shortName(skip), next ? shortName(next) : '')}</p>
            <Link className="btn btn-secondary btn-sm" href={`/kiem-tra/${skip.id}?skip=1`}>{L.elsewhereCta}</Link>
          </Card>
        )
      )}
      {!mobile && (
        <Card soft className="stack-2">
          <div className="row">
            <span className="tile yellow" style={{ width: 44, height: 36, fontSize: 20 }}><Icon name="star" /></span>
            <b>{L.reviewTitle}</b>
          </div>
          <p className="small">{L.reviewBody}</p>
        </Card>
      )}
    </>
  );
}

function Trail({ unit, stages, currentId, currentRef }: {
  unit: PathUnit; stages: PathStage[]; currentId: string | undefined;
  currentRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const toast = useToast();
  const [openId, setOpenId] = useState<string | null>(null);
  const total = unit.lessons.length;

  const click = (l: PathLesson) => {
    if (l.status === 'locked') {
      setOpenId(null);
      toast(lockMessage(l.lockReason, stages));
      return;
    }
    setOpenId((cur) => (cur === l.id ? null : l.id));
  };

  return (
    <div className="trail">
      {unit.lessons.flatMap((l, i) => {
        const x = nodeOffset(i);
        const test = l.type === 'checkpoint';
        const locked = l.status === 'locked';
        const isCurrent = l.id === currentId;
        const done = l.status === 'completed';
        const cls = ['node', locked && 'locked', test && 'test', isCurrent && 'current'].filter(Boolean).join(' ');
        const state = L.state[l.status];
        const nodes = [
          <div key={l.id} className="slot" style={{ ['--x' as string]: `${x}px` }}>
            <button
              type="button"
              ref={isCurrent ? currentRef : undefined}
              className={cls}
              data-flag={isCurrent ? L.current : undefined}
              lang={!locked && !test ? 'zh' : undefined}
              aria-label={L.nodeAria(l.order, l.title, state)}
              aria-expanded={locked ? undefined : openId === l.id}
              onClick={() => click(l)}
            >
              {locked && !test ? <Icon name="lock" /> : test ? <Icon name={locked ? 'lock' : 'star'} /> : done && l.keyChar ? l.keyChar : <Icon name="play" />}
            </button>
          </div>,
        ];
        if (openId === l.id) {
          nodes.push(
            <div key={`${l.id}-pop`} className="pop" style={{ ['--ax' as string]: `calc(50% + ${x}px)` }}>
              {done ? (
                <>
                  <b>{L.doneTitle}</b>
                  <p>{L.doneBody}</p>
                  <Link className="btn btn-white btn-sm" style={{ marginTop: 8 }} href={`/bai/${l.id}`}>{L.replay}</Link>
                </>
              ) : (
                <>
                  <p className="eyebrow">{L.lessonOf(l.order, total, l.estimatedMinutes)}</p>
                  <b style={{ font: '800 var(--text-lg) var(--font-display)' }}>{l.title}</b>
                  <p>{[L.newWords(l.newWordCount), ...l.skills.map((k) => L.skill[k])].join(' · ')}</p>
                  <Link className="btn btn-white btn-block" style={{ marginTop: 12 }} href={`/bai/${l.id}`}>
                    {l.status === 'in_progress' ? L.resume : L.start}
                  </Link>
                </>
              )}
            </div>,
          );
        }
        return nodes;
      })}
    </div>
  );
}

function Screen({ data }: { data: PathData }) {
  const toast = useToast();
  const [stageId, setStageId] = useState<PathStage['id'] | undefined>(() => defaultStage(data.stages)?.id);
  const [chooser, setChooser] = useState(false);
  const currentRef = useRef<HTMLButtonElement>(null);
  const stage = data.stages.find((s) => s.id === stageId) ?? defaultStage(data.stages);
  const cur = stage ? currentLesson(stage) : undefined;

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center' });
  }, [stage?.id, cur?.id]);

  const pick = useCallback((id: PathStage['id']) => {
    setStageId(id);
    setChooser(false);
  }, []);

  if (!stage) return null;
  const lockedUnits = stage.units.some((u) => u.status === 'locked');
  const exam = stage.finalExam;

  return (
    <>
      <header className="topbar">
        <button
          type="button"
          className="btn btn-secondary"
          style={{ margin: 0, textTransform: 'none', fontSize: 'var(--text-lg)' }}
          aria-haspopup="dialog"
          aria-label={`${L.switchStage}: ${stage.title}`}
          onClick={() => setChooser(true)}
        >
          {stage.title} <Icon name="down" />
        </button>
        <Badge variant="blue">{percent(stage)}%</Badge>
      </header>
      <div className="cols has-rail">
        <section aria-label={L.trailLabel(stage.title)} style={{ maxWidth: 520, width: '100%', margin: '0 auto' }}>
          {stage.units.map((u) => {
            const locked = u.status === 'locked' || u.status === 'coming_soon';
            return (
              <div key={u.id}>
                <div className={`unit${locked ? ' locked' : ''}`}>
                  <div>
                    <p className="eyebrow">{L.unitEyebrow(u.order)}</p>
                    <h3>{u.title}</h3>
                    {!locked && u.sampleWords.length > 0 && (
                      <p className="small" lang="zh" style={{ marginTop: 4, fontWeight: 600 }}>{u.sampleWords.join(' · ')}</p>
                    )}
                  </div>
                  {u.status === 'coming_soon' ? (
                    <Badge>{L.comingSoon}</Badge>
                  ) : locked ? (
                    <Icon name="lock" />
                  ) : (
                    <Badge>{L.unitCount(u.doneCount, u.total)}</Badge>
                  )}
                </div>
                {u.status !== 'coming_soon' && (
                  <Trail unit={u} stages={data.stages} currentId={cur?.id} currentRef={currentRef} />
                )}
              </div>
            );
          })}
          {lockedUnits && <p className="center small muted" style={{ marginTop: 'var(--space-4)' }}>{L.unitLocked}</p>}
          {exam !== 'none' && (
            <div className="path-end">
              {exam === 'available' ? (
                <Link className="btn btn-primary" href={`/kiem-tra/${stage.id}`}>{L.finalExam}</Link>
              ) : (
                <Button aria-label={`${L.finalExam}, ${L.state.locked}`} variant="secondary" onClick={() => toast(L.finalExamLocked)}>
                  <Icon name="lock" />{L.finalExam}
                </Button>
              )}
            </div>
          )}
        </section>
        <aside className="rail sticky path-rail" aria-label={L.stages}>
          <h3>{L.stages}</h3>
          <SidePanels data={data} onPick={pick} />
        </aside>
      </div>
      <Sheet open={chooser} onClose={() => setChooser(false)} label={L.switchStage}>
        <div className="row between">
          <h2>{L.switchStage}</h2>
          <IconButton icon="close" label={L.close} onClick={() => setChooser(false)} />
        </div>
        <SidePanels data={data} onPick={pick} mobile />
      </Sheet>
    </>
  );
}

export function PathView() {
  const [state, setState] = useState<Load>({ kind: 'loading' });

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      setState({ kind: 'ok', data: await apiFetch<PathData>('/api/path') });
    } catch (e) {
      setState({ kind: e instanceof ApiClientError && e.status === 401 ? 'guest' : 'error' });
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <ToastProvider>
      {state.kind === 'loading' && <p className="center muted" role="status">{L.loading}</p>}
      {state.kind === 'guest' && (
        <Card className="stack-3" style={{ maxWidth: 520, margin: '0 auto' }}>
          <h2>{L.guestTitle}</h2>
          <p>{L.guestBody}</p>
        </Card>
      )}
      {state.kind === 'error' && (
        <div className="stack-3 center">
          <p>{L.loadError}</p>
          <Button variant="secondary" onClick={() => void load()}>{L.retry}</Button>
        </div>
      )}
      {state.kind === 'ok' && <Screen data={state.data} />}
    </ToastProvider>
  );
}
