export interface ParsedCodec {
  raw: string;
  type: 'video' | 'audio' | 'unknown';
  name: string;
  profile?: string;
  level?: string;
  supported: boolean | null; // null = can't check
}

/**
 * Parse a CODECS attribute string (comma-separated) into human-readable descriptions.
 */
export function parseCodecs(codecsString: string | undefined): ParsedCodec[] {
  if (!codecsString) return [];
  return codecsString.split(',').map(c => parseOneCodec(c.trim()));
}

/**
 * Format parsed codecs as a short human-readable string.
 * e.g. "H.264 High L4.0, AAC-LC"
 */
export function formatCodecs(codecs: ParsedCodec[]): string {
  return codecs.map(c => {
    let s = c.name;
    if (c.profile) s += ` ${c.profile}`;
    if (c.level) s += ` L${c.level}`;
    return s;
  }).join(', ');
}

function parseOneCodec(raw: string): ParsedCodec {
  // AVC / H.264: avc1.PPCCLL or avc1.XX.XX
  if (/^avc[13]\./.test(raw)) return parseAvc(raw);

  // HEVC / H.265: hvc1.P.T.LXXX or hev1.P.T.LXXX
  if (/^(?:hvc1|hev1)\./.test(raw)) return parseHevc(raw);

  // AV1: av01.P.LLM.DD
  if (/^av01\./.test(raw)) return parseAv1(raw);

  // VP9: vp09.PP.LL.DD
  if (/^vp09\./.test(raw)) return parseVp9(raw);

  // VP8
  if (raw === 'vp8' || raw.startsWith('vp08')) {
    return { raw, type: 'video', name: 'VP8', supported: checkSupport(raw) };
  }

  // AAC: mp4a.40.X
  if (/^mp4a\./.test(raw)) return parseAac(raw);

  // AC-3 / EC-3 (Dolby)
  if (raw === 'ac-3') return { raw, type: 'audio', name: 'AC-3 (Dolby Digital)', supported: checkSupport(raw) };
  if (raw === 'ec-3') return { raw, type: 'audio', name: 'E-AC-3 (Dolby Digital Plus)', supported: checkSupport(raw) };

  // Dolby Atmos (usually ec-3 with JOC)
  if (raw === 'ec+3') return { raw, type: 'audio', name: 'E-AC-3 + Atmos', supported: checkSupport(raw) };

  // Opus
  if (raw === 'opus' || raw === 'Opus') return { raw, type: 'audio', name: 'Opus', supported: checkSupport(raw) };

  // FLAC
  if (raw === 'flac' || raw === 'fLaC') return { raw, type: 'audio', name: 'FLAC', supported: checkSupport(raw) };

  // MP3
  if (raw === 'mp3' || raw === 'mp4a.69' || raw === 'mp4a.6B') {
    return { raw, type: 'audio', name: 'MP3', supported: checkSupport(raw) };
  }

  // Vorbis
  if (raw === 'vorbis') return { raw, type: 'audio', name: 'Vorbis', supported: checkSupport(raw) };

  // ALAC
  if (raw === 'alac') return { raw, type: 'audio', name: 'ALAC (Apple Lossless)', supported: checkSupport(raw) };

  // DTS
  if (raw.startsWith('dtsc') || raw.startsWith('dtse') || raw.startsWith('dtsx')) {
    return { raw, type: 'audio', name: 'DTS', supported: checkSupport(raw) };
  }

  // Subtitle codecs
  if (raw === 'wvtt') return { raw, type: 'unknown', name: 'WebVTT', supported: null };
  if (raw === 'stpp' || raw.startsWith('stpp.')) return { raw, type: 'unknown', name: 'TTML', supported: null };

  return { raw, type: 'unknown', name: raw, supported: null };
}

// AVC profile/level from hex: avc1.PPCCLL
const AVC_PROFILES: Record<number, string> = {
  66: 'Baseline',
  77: 'Main',
  88: 'Extended',
  100: 'High',
  110: 'High 10',
  122: 'High 4:2:2',
  244: 'High 4:4:4 Predictive',
};

function parseAvc(raw: string): ParsedCodec {
  const parts = raw.split('.');
  let profile: string | undefined;
  let level: string | undefined;

  if (parts.length >= 2 && parts[1].length === 6) {
    // avc1.PPCCLL format
    const hex = parts[1];
    const profileIdc = parseInt(hex.slice(0, 2), 16);
    const levelIdc = parseInt(hex.slice(4, 6), 16);
    profile = AVC_PROFILES[profileIdc] ?? `Profile ${profileIdc}`;
    level = (levelIdc / 10).toFixed(1).replace(/\.0$/, '.0');
  } else if (parts.length >= 3) {
    // avc1.XX.XX format
    const profileIdc = parseInt(parts[1], 10);
    if (!isNaN(profileIdc)) profile = AVC_PROFILES[profileIdc] ?? `Profile ${profileIdc}`;
    const levelIdc = parseInt(parts[2], 10);
    if (!isNaN(levelIdc)) level = (levelIdc / 10).toFixed(1);
  }

  return { raw, type: 'video', name: 'H.264', profile, level, supported: checkSupport(raw) };
}

const HEVC_PROFILES: Record<string, string> = {
  '1': 'Main',
  '2': 'Main 10',
  '3': 'Main Still Picture',
};

function parseHevc(raw: string): ParsedCodec {
  const parts = raw.split('.');
  let profile: string | undefined;
  let level: string | undefined;

  if (parts.length >= 2) {
    profile = HEVC_PROFILES[parts[1]] ?? `Profile ${parts[1]}`;
  }
  if (parts.length >= 4) {
    // Level is like L93 or L120 (divide by 30)
    const levelStr = parts[3].replace(/^[LH]/, '');
    const levelNum = parseInt(levelStr, 10);
    if (!isNaN(levelNum)) level = (levelNum / 30).toFixed(1);
  }

  return { raw, type: 'video', name: 'HEVC', profile, level, supported: checkSupport(raw) };
}

const AV1_PROFILES: Record<string, string> = {
  '0': 'Main',
  '1': 'High',
  '2': 'Professional',
};

function parseAv1(raw: string): ParsedCodec {
  const parts = raw.split('.');
  let profile: string | undefined;
  let level: string | undefined;

  if (parts.length >= 2) {
    profile = AV1_PROFILES[parts[1]] ?? `Profile ${parts[1]}`;
  }
  if (parts.length >= 3) {
    const levelIdx = parseInt(parts[2], 10);
    if (!isNaN(levelIdx)) {
      const major = 2 + Math.floor(levelIdx / 4);
      const minor = levelIdx % 4;
      level = `${major}.${minor}`;
    }
  }

  return { raw, type: 'video', name: 'AV1', profile, level, supported: checkSupport(raw) };
}

function parseVp9(raw: string): ParsedCodec {
  const parts = raw.split('.');
  let profile: string | undefined;
  let level: string | undefined;

  if (parts.length >= 2) {
    profile = `Profile ${parts[1]}`;
  }
  if (parts.length >= 3) {
    const l = parseInt(parts[2], 10);
    if (!isNaN(l)) level = `${Math.floor(l / 10)}.${l % 10}`;
  }

  return { raw, type: 'video', name: 'VP9', profile, level, supported: checkSupport(raw) };
}

const AAC_OBJECT_TYPES: Record<string, string> = {
  '2': 'AAC-LC',
  '5': 'HE-AAC (SBR)',
  '29': 'HE-AAC v2 (SBR+PS)',
  '23': 'ER AAC-LD',
  '39': 'ER AAC-ELD',
  '42': 'xHE-AAC (USAC)',
};

function parseAac(raw: string): ParsedCodec {
  // mp4a.40.X where X is the object type
  const parts = raw.split('.');
  let name = 'AAC';

  if (parts.length >= 3) {
    name = AAC_OBJECT_TYPES[parts[2]] ?? `AAC (OTI ${parts[2]})`;
  } else if (parts.length === 2 && parts[1] === '40') {
    name = 'AAC';
  } else if (parts[1] === '69' || parts[1] === '6B') {
    name = 'MP3';
  }

  return { raw, type: 'audio', name, supported: checkSupport(raw) };
}

function checkSupport(codec: string): boolean | null {
  if (typeof MediaSource === 'undefined' || !MediaSource.isTypeSupported) return null;
  // Try both mp4 and mp2t containers
  return (
    MediaSource.isTypeSupported(`video/mp4; codecs="${codec}"`) ||
    MediaSource.isTypeSupported(`audio/mp4; codecs="${codec}"`) ||
    MediaSource.isTypeSupported(`video/mp2t; codecs="${codec}"`)
  );
}
