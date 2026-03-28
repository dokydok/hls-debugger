import type { SegmentInfo } from './types';

export interface AdBreak {
  index: number;
  startSegmentIndex: number;
  endSegmentIndex: number | null;
  startTime: number;
  endTime: number | null;
  declaredDuration: number | null;
  actualDuration: number | null;
  segmentCount: number;
  isPaired: boolean;
  hasDurationMismatch: boolean;
}

export interface AdBreakAnalysis {
  breaks: AdBreak[];
  totalAdTime: number;
  totalBreaks: number;
  unpairedCueOuts: number;
  orphanCueIns: number;
  durationMismatches: number;
  totalPlaylistDuration: number;
}

export function analyzeAdBreaks(segments: SegmentInfo[]): AdBreakAnalysis {
  const breaks: AdBreak[] = [];
  let currentBreak: AdBreak | null = null;
  let cumulativeTime = 0;
  let orphanCueIns = 0;
  let breakIndex = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    // CUE-OUT: start a new ad break
    if (seg.cueOut != null) {
      // Close any unclosed previous break
      if (currentBreak) {
        finalizeBreak(currentBreak, cumulativeTime);
        breaks.push(currentBreak);
      }

      const declared = parseDuration(seg.cueOut);
      currentBreak = {
        index: breakIndex++,
        startSegmentIndex: i,
        endSegmentIndex: null,
        startTime: cumulativeTime,
        endTime: null,
        declaredDuration: declared,
        actualDuration: null,
        segmentCount: 0,
        isPaired: false,
        hasDurationMismatch: false,
      };
    }

    // Count segment as part of current break
    if (currentBreak) {
      currentBreak.segmentCount++;
    }

    // CUE-IN: close the current break
    if (seg.cueIn != null) {
      if (currentBreak) {
        currentBreak.endSegmentIndex = i;
        currentBreak.isPaired = true;
        finalizeBreak(currentBreak, cumulativeTime + seg.duration);
        breaks.push(currentBreak);
        currentBreak = null;
      } else {
        orphanCueIns++;
      }
    }

    cumulativeTime += seg.duration;
  }

  // Handle unclosed break at end
  if (currentBreak) {
    finalizeBreak(currentBreak, cumulativeTime);
    breaks.push(currentBreak);
  }

  const totalAdTime = breaks.reduce((sum, b) => sum + (b.actualDuration ?? 0), 0);
  const unpairedCueOuts = breaks.filter(b => !b.isPaired).length;
  const durationMismatches = breaks.filter(b => b.hasDurationMismatch).length;

  return {
    breaks,
    totalAdTime,
    totalBreaks: breaks.length,
    unpairedCueOuts,
    orphanCueIns,
    durationMismatches,
    totalPlaylistDuration: cumulativeTime,
  };
}

function finalizeBreak(brk: AdBreak, endTime: number): void {
  brk.endTime = endTime;
  brk.actualDuration = endTime - brk.startTime;

  if (brk.declaredDuration != null && brk.actualDuration > 0) {
    const diff = Math.abs(brk.declaredDuration - brk.actualDuration);
    brk.hasDurationMismatch = diff / brk.declaredDuration > 0.1;
  }
}

function parseDuration(value: string): number | null {
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}
