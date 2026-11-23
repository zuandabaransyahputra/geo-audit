export function scoreTone(score: number): 'pass' | 'warn' | 'fail' {
  return score >= 80 ? 'pass' : score >= 55 ? 'warn' : 'fail';
}

const STROKE = { pass: 'var(--pass)', warn: 'var(--warn)', fail: 'var(--fail)' };

export function ScoreRing({ score, grade, size = 148 }: { score: number; grade: string; size?: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const tone = scoreTone(score);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Score ${score} out of 100, grade ${grade}`}>
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--muted)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={STROKE[tone]}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          className="animate-ring"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-semibold tabular-nums tracking-tight">{score}</span>
        <span className="text-xs text-muted-foreground">of 100</span>
      </div>
    </div>
  );
}
