import {IClone, IOptions, IStatistic} from '@jscpd/core';
import {IReporter} from '..';
import {getPath, getSourceLocation} from '../utils/reports';

function cloneLines(clone: IClone): number {
  return Math.max(
    clone.duplicationA.end.line - clone.duplicationA.start.line,
    clone.duplicationB.end.line - clone.duplicationB.start.line,
    1,
  );
}

function cloneTokens(clone: IClone): number {
  return clone.duplicationA.range[1] - clone.duplicationA.range[0];
}

function byLargestFirst(a: IClone, b: IClone): number {
  return cloneLines(b) - cloneLines(a);
}

export class LlmReporter implements IReporter {
  constructor(private readonly options: IOptions) {}

  public report(clones: IClone[], statistic: IStatistic | undefined): void {
    const maxLines = this.options.reportersOptions?.llm?.maxLines ?? 30;

    const header = this.formatHeader(clones.length, statistic);
    const sorted = [...clones].sort(byLargestFirst);
    const {entries, omittedCount, omittedLines} = this.formatClones(sorted, maxLines);

    const output = [header, '', ...entries];
    if (omittedCount > 0) {
      output.push(`... and ${omittedCount} more clones (${omittedLines}l total)`);
    }

    console.log(output.join('\n'));
  }

  private formatHeader(count: number, statistic: IStatistic | undefined): string {
    if (!statistic) {
      return `Copy Detection: ${count} clones`;
    }
    const s = statistic.total;
    const pct = s.percentage?.toFixed(1) ?? '?';
    return `Copy Detection: ${count} clones, ${s.duplicatedLines} Lines (l) / ${s.duplicatedTokens} Tokens (t) duplicated in ${s.lines} lines - ${pct}%`;
  }

  private formatClone(clone: IClone): string {
    const pathA = getPath(clone.duplicationA.sourceId, this.options);
    const pathB = getPath(clone.duplicationB.sourceId, this.options);
    const locA = getSourceLocation(clone.duplicationA.start, clone.duplicationA.end);
    const locB = getSourceLocation(clone.duplicationB.start, clone.duplicationB.end);
    const tag = `${cloneLines(clone)}l/${cloneTokens(clone)}t`;

    return pathA === pathB
      ? `${pathA} [${locA}] ↔ [${locB}] ${tag}`
      : `${pathA} [${locA}] ↔ ${pathB} [${locB}] ${tag}`;
  }

  private formatClones(
    clones: IClone[],
    maxLines: number,
  ): {entries: string[]; omittedCount: number; omittedLines: number} {
    const entries: string[] = [];
    let omittedCount = 0;
    let omittedLines = 0;

    for (const clone of clones) {
      if (maxLines > 0 && entries.length >= maxLines) {
        omittedCount++;
        omittedLines += cloneLines(clone);
        continue;
      }

      entries.push(this.formatClone(clone));
    }

    return {entries, omittedCount, omittedLines};
  }
}
