/**
 * Standard Thread Sizes and Specifications
 *
 * Reference data for metric (ISO) and imperial (UNC/UNF) thread specifications.
 * All dimensions in millimeters unless otherwise noted.
 */

// ==================== Metric Threads (ISO) ====================

/**
 * ISO Metric Coarse Thread Specifications
 * Format: { pitch: thread pitch, majorDia: nominal/major diameter, minorDia: minor diameter (internal), tapDrill: recommended tap drill }
 */
export const METRIC_THREADS = {
  M2: { pitch: 0.4, majorDia: 2, minorDia: 1.567, tapDrill: 1.6 },
  'M2.5': { pitch: 0.45, majorDia: 2.5, minorDia: 2.013, tapDrill: 2.05 },
  M3: { pitch: 0.5, majorDia: 3, minorDia: 2.459, tapDrill: 2.5 },
  M4: { pitch: 0.7, majorDia: 4, minorDia: 3.242, tapDrill: 3.3 },
  M5: { pitch: 0.8, majorDia: 5, minorDia: 4.134, tapDrill: 4.2 },
  M6: { pitch: 1.0, majorDia: 6, minorDia: 4.917, tapDrill: 5.0 },
  M8: { pitch: 1.25, majorDia: 8, minorDia: 6.647, tapDrill: 6.8 },
  M10: { pitch: 1.5, majorDia: 10, minorDia: 8.376, tapDrill: 8.5 },
  M12: { pitch: 1.75, majorDia: 12, minorDia: 10.106, tapDrill: 10.2 },
  M14: { pitch: 2.0, majorDia: 14, minorDia: 11.835, tapDrill: 12.0 },
  M16: { pitch: 2.0, majorDia: 16, minorDia: 13.835, tapDrill: 14.0 },
  M18: { pitch: 2.5, majorDia: 18, minorDia: 15.294, tapDrill: 15.5 },
  M20: { pitch: 2.5, majorDia: 20, minorDia: 17.294, tapDrill: 17.5 },
  M22: { pitch: 2.5, majorDia: 22, minorDia: 19.294, tapDrill: 19.5 },
  M24: { pitch: 3.0, majorDia: 24, minorDia: 20.752, tapDrill: 21.0 },
  M27: { pitch: 3.0, majorDia: 27, minorDia: 23.752, tapDrill: 24.0 },
  M30: { pitch: 3.5, majorDia: 30, minorDia: 26.211, tapDrill: 26.5 },
};

/**
 * ISO Metric Fine Thread Specifications (for applications requiring finer threads)
 * Key: 'MxP' format (e.g., 'M10x1.25' for M10 with 1.25mm pitch)
 */
export const METRIC_FINE_THREADS = {
  'M6x0.75': { pitch: 0.75, majorDia: 6, minorDia: 5.188, tapDrill: 5.25 },
  'M8x1': { pitch: 1.0, majorDia: 8, minorDia: 6.917, tapDrill: 7.0 },
  'M10x1': { pitch: 1.0, majorDia: 10, minorDia: 8.917, tapDrill: 9.0 },
  'M10x1.25': { pitch: 1.25, majorDia: 10, minorDia: 8.647, tapDrill: 8.75 },
  'M12x1.25': { pitch: 1.25, majorDia: 12, minorDia: 10.647, tapDrill: 10.75 },
  'M12x1.5': { pitch: 1.5, majorDia: 12, minorDia: 10.376, tapDrill: 10.5 },
  'M14x1.5': { pitch: 1.5, majorDia: 14, minorDia: 12.376, tapDrill: 12.5 },
  'M16x1.5': { pitch: 1.5, majorDia: 16, minorDia: 14.376, tapDrill: 14.5 },
  'M18x1.5': { pitch: 1.5, majorDia: 18, minorDia: 16.376, tapDrill: 16.5 },
  'M20x1.5': { pitch: 1.5, majorDia: 20, minorDia: 18.376, tapDrill: 18.5 },
  'M20x2': { pitch: 2.0, majorDia: 20, minorDia: 17.835, tapDrill: 18.0 },
  'M24x2': { pitch: 2.0, majorDia: 24, minorDia: 21.835, tapDrill: 22.0 },
};

// ==================== Imperial Threads (ANSI/ASME) ====================

/**
 * Unified National Coarse (UNC) Thread Specifications
 * Format: { tpi: threads per inch, majorDia: major diameter in mm, pitch: pitch in mm, tapDrill: tap drill in mm }
 */
export const IMPERIAL_THREADS = {
  '#2-56': { tpi: 56, majorDia: 2.184, pitch: 0.454, tapDrill: 1.85 },
  '#4-40': { tpi: 40, majorDia: 2.845, pitch: 0.635, tapDrill: 2.26 },
  '#6-32': { tpi: 32, majorDia: 3.505, pitch: 0.794, tapDrill: 2.69 },
  '#8-32': { tpi: 32, majorDia: 4.166, pitch: 0.794, tapDrill: 3.45 },
  '#10-24': { tpi: 24, majorDia: 4.826, pitch: 1.058, tapDrill: 3.80 },
  '#10-32': { tpi: 32, majorDia: 4.826, pitch: 0.794, tapDrill: 4.09 },
  '1/4-20': { tpi: 20, majorDia: 6.35, pitch: 1.27, tapDrill: 5.11 },
  '5/16-18': { tpi: 18, majorDia: 7.938, pitch: 1.411, tapDrill: 6.53 },
  '3/8-16': { tpi: 16, majorDia: 9.525, pitch: 1.588, tapDrill: 7.94 },
  '7/16-14': { tpi: 14, majorDia: 11.113, pitch: 1.814, tapDrill: 9.35 },
  '1/2-13': { tpi: 13, majorDia: 12.7, pitch: 1.954, tapDrill: 10.80 },
  '9/16-12': { tpi: 12, majorDia: 14.288, pitch: 2.117, tapDrill: 12.20 },
  '5/8-11': { tpi: 11, majorDia: 15.875, pitch: 2.309, tapDrill: 13.49 },
  '3/4-10': { tpi: 10, majorDia: 19.05, pitch: 2.54, tapDrill: 16.51 },
  '7/8-9': { tpi: 9, majorDia: 22.225, pitch: 2.822, tapDrill: 19.45 },
  '1-8': { tpi: 8, majorDia: 25.4, pitch: 3.175, tapDrill: 22.23 },
};

/**
 * Unified National Fine (UNF) Thread Specifications
 */
export const IMPERIAL_FINE_THREADS = {
  '#4-48': { tpi: 48, majorDia: 2.845, pitch: 0.529, tapDrill: 2.39 },
  '#6-40': { tpi: 40, majorDia: 3.505, pitch: 0.635, tapDrill: 2.95 },
  '#8-36': { tpi: 36, majorDia: 4.166, pitch: 0.705, tapDrill: 3.51 },
  '#10-32': { tpi: 32, majorDia: 4.826, pitch: 0.794, tapDrill: 4.09 },
  '1/4-28': { tpi: 28, majorDia: 6.35, pitch: 0.907, tapDrill: 5.49 },
  '5/16-24': { tpi: 24, majorDia: 7.938, pitch: 1.058, tapDrill: 6.91 },
  '3/8-24': { tpi: 24, majorDia: 9.525, pitch: 1.058, tapDrill: 8.51 },
  '7/16-20': { tpi: 20, majorDia: 11.113, pitch: 1.27, tapDrill: 9.93 },
  '1/2-20': { tpi: 20, majorDia: 12.7, pitch: 1.27, tapDrill: 11.51 },
  '9/16-18': { tpi: 18, majorDia: 14.288, pitch: 1.411, tapDrill: 12.91 },
  '5/8-18': { tpi: 18, majorDia: 15.875, pitch: 1.411, tapDrill: 14.48 },
  '3/4-16': { tpi: 16, majorDia: 19.05, pitch: 1.588, tapDrill: 17.48 },
};

// ==================== Thread Profile Geometry ====================

/**
 * ISO Metric Thread Profile (60° included angle)
 * Returns fundamental triangle height H = pitch * sqrt(3) / 2
 */
export function getISOThreadHeight(pitch) {
  const H = pitch * Math.sqrt(3) / 2;
  return {
    H, // Fundamental triangle height
    h: H * 5 / 8, // Actual thread height (external)
    hInternal: H * 5 / 8, // Internal thread depth
    r: H / 6, // Root radius
    crest: pitch / 8, // Crest flat width
    root: pitch / 4, // Root flat width
  };
}

/**
 * Thread depth as function of pitch (standard ISO approximation)
 * External thread depth ≈ 0.6134 × pitch
 * Internal thread depth ≈ 0.5413 × pitch
 */
export function getThreadDepth(pitch, isExternal = true) {
  return isExternal ? pitch * 0.6134 : pitch * 0.5413;
}

// ==================== Thread Lookup Functions ====================

/**
 * Parse a thread specification string
 * Supports formats: 'M10', 'M10x1.5', '1/4-20', '#10-24'
 * @param {string} spec - Thread specification
 * @returns {{ metric: boolean, nominalDiameter: number, pitch?: number, tpi?: number, threadData?: object }}
 */
export function parseThreadSpec(spec) {
  const normalized = spec.trim().toUpperCase();

  // Metric: M10, M10x1.5, M10X1.5
  if (normalized.startsWith('M')) {
    const match = normalized.match(/^M(\d+(?:\.\d+)?)(X(\d+(?:\.\d+)?))?$/);
    if (match) {
      const nominal = parseFloat(match[1]);
      const specifiedPitch = match[3] ? parseFloat(match[3]) : null;

      // Look up thread data
      const key = specifiedPitch ? `M${nominal}x${specifiedPitch}` : `M${nominal}`;
      const threadData =
        specifiedPitch ? METRIC_FINE_THREADS[key] : METRIC_THREADS[key];

      return {
        metric: true,
        nominalDiameter: nominal,
        pitch: specifiedPitch || (threadData ? threadData.pitch : null),
        threadData: threadData || null,
      };
    }
  }

  // Imperial numbered: #4-40, #10-24
  const numMatch = normalized.match(/^#(\d+)-(\d+)$/);
  if (numMatch) {
    const number = parseInt(numMatch[1], 10);
    const tpi = parseInt(numMatch[2], 10);
    // Standard formula: diameter = 0.060 + (number * 0.013) inches
    const nominalDia = (0.060 + number * 0.013) * 25.4; // Convert to mm
    const key = `#${number}-${tpi}`;
    const threadData = IMPERIAL_THREADS[key] || IMPERIAL_FINE_THREADS[key];

    return {
      metric: false,
      nominalDiameter: nominalDia,
      tpi,
      pitch: 25.4 / tpi,
      threadData: threadData || null,
    };
  }

  // Imperial fractional: 1/4-20, 3/8-16
  const fracMatch = normalized.match(/^(\d+)\/(\d+)-(\d+)$/);
  if (fracMatch) {
    const num = parseInt(fracMatch[1], 10);
    const denom = parseInt(fracMatch[2], 10);
    const tpi = parseInt(fracMatch[3], 10);
    const nominalDia = (num / denom) * 25.4; // Convert to mm
    const key = `${num}/${denom}-${tpi}`;
    const threadData = IMPERIAL_THREADS[key] || IMPERIAL_FINE_THREADS[key];

    return {
      metric: false,
      nominalDiameter: nominalDia,
      tpi,
      pitch: 25.4 / tpi,
      threadData: threadData || null,
    };
  }

  // Plain number with pitch: 10 1.5 (for command line)
  const plainMatch = normalized.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/);
  if (plainMatch) {
    const nominal = parseFloat(plainMatch[1]);
    const pitch = parseFloat(plainMatch[2]);
    const key = `M${nominal}`;
    const threadData = METRIC_THREADS[key];

    return {
      metric: true,
      nominalDiameter: nominal,
      pitch,
      threadData: threadData || null,
    };
  }

  throw new Error(`Invalid thread specification: ${spec}`);
}

/**
 * Get thread parameters for a standard size
 * @param {string} spec - Thread spec (e.g., 'M10', '1/4-20')
 * @param {string} type - 'external' or 'internal'
 * @returns {{ majorDia: number, minorDia: number, pitch: number, tapDrill?: number, depth: number }}
 */
export function getThreadParams(spec, type = 'external') {
  const parsed = parseThreadSpec(spec);

  if (parsed.threadData) {
    const depth = getThreadDepth(parsed.threadData.pitch, type === 'external');
    return {
      majorDia: parsed.threadData.majorDia,
      minorDia: parsed.threadData.minorDia || parsed.threadData.majorDia - 2 * depth,
      pitch: parsed.threadData.pitch,
      tapDrill: parsed.threadData.tapDrill,
      depth,
      tpi: parsed.threadData.tpi,
    };
  }

  // Fallback calculation if exact spec not found
  const pitch = parsed.pitch || (parsed.metric ? parsed.nominalDiameter * 0.15 : 25.4 / (parsed.tpi || 20));
  const depth = getThreadDepth(pitch, type === 'external');

  return {
    majorDia: parsed.nominalDiameter,
    minorDia: parsed.nominalDiameter - 2 * depth,
    pitch,
    depth,
  };
}

/**
 * List all available standard thread sizes
 * @param {boolean} metric - true for metric, false for imperial
 * @param {boolean} includeFine - include fine thread variants
 * @returns {string[]}
 */
export function listThreadSizes(metric = true, includeFine = false) {
  if (metric) {
    const coarse = Object.keys(METRIC_THREADS);
    if (includeFine) {
      return [...coarse, ...Object.keys(METRIC_FINE_THREADS)].sort((a, b) => {
        const aNum = parseFloat(a.replace(/^M/, '').split('x')[0]);
        const bNum = parseFloat(b.replace(/^M/, '').split('x')[0]);
        return aNum - bNum;
      });
    }
    return coarse;
  } else {
    const coarse = Object.keys(IMPERIAL_THREADS);
    if (includeFine) {
      return [...coarse, ...Object.keys(IMPERIAL_FINE_THREADS)];
    }
    return coarse;
  }
}

export default {
  METRIC_THREADS,
  METRIC_FINE_THREADS,
  IMPERIAL_THREADS,
  IMPERIAL_FINE_THREADS,
  getISOThreadHeight,
  getThreadDepth,
  parseThreadSpec,
  getThreadParams,
  listThreadSizes,
};
