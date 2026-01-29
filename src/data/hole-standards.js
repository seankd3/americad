/**
 * Standard Hole Sizes and Fastener Data
 * 
 * Reference data for common fasteners and hole specifications.
 * All dimensions in millimeters unless otherwise noted.
 */

// ==================== Metric Standards (ISO) ====================

/**
 * Metric clearance holes (ISO 273)
 * Format: { close: diameter, normal: diameter, loose: diameter }
 */
export const METRIC_CLEARANCE = {
    'M2':    { close: 2.2,  normal: 2.4,  loose: 2.6 },
    'M2.5':  { close: 2.7,  normal: 2.9,  loose: 3.1 },
    'M3':    { close: 3.2,  normal: 3.4,  loose: 3.6 },
    'M4':    { close: 4.3,  normal: 4.5,  loose: 4.8 },
    'M5':    { close: 5.3,  normal: 5.5,  loose: 5.8 },
    'M6':    { close: 6.4,  normal: 6.6,  loose: 7.0 },
    'M8':    { close: 8.4,  normal: 9.0,  loose: 10.0 },
    'M10':   { close: 10.5, normal: 11.0, loose: 12.0 },
    'M12':   { close: 13.0, normal: 13.5, loose: 14.5 },
    'M14':   { close: 15.0, normal: 15.5, loose: 16.5 },
    'M16':   { close: 17.0, normal: 17.5, loose: 18.5 },
    'M20':   { close: 21.0, normal: 22.0, loose: 24.0 }
};

/**
 * Metric tap drill sizes (for ~75% thread engagement)
 * Format: { drill: diameter, pitch: standard pitch }
 */
export const METRIC_TAP_DRILL = {
    'M2':    { drill: 1.6,  pitch: 0.4 },
    'M2.5':  { drill: 2.05, pitch: 0.45 },
    'M3':    { drill: 2.5,  pitch: 0.5 },
    'M4':    { drill: 3.3,  pitch: 0.7 },
    'M5':    { drill: 4.2,  pitch: 0.8 },
    'M6':    { drill: 5.0,  pitch: 1.0 },
    'M8':    { drill: 6.8,  pitch: 1.25 },
    'M10':   { drill: 8.5,  pitch: 1.5 },
    'M12':   { drill: 10.2, pitch: 1.75 },
    'M14':   { drill: 12.0, pitch: 2.0 },
    'M16':   { drill: 14.0, pitch: 2.0 },
    'M20':   { drill: 17.5, pitch: 2.5 }
};

/**
 * Metric socket head cap screw counterbore sizes (ISO 4762 / DIN 912)
 * Format: { cbDiameter: counterbore diameter, cbDepth: counterbore depth (head height) }
 */
export const METRIC_SHCS_COUNTERBORE = {
    'M2':    { cbDiameter: 4.4,  cbDepth: 2.0 },
    'M2.5':  { cbDiameter: 5.4,  cbDepth: 2.5 },
    'M3':    { cbDiameter: 6.5,  cbDepth: 3.0 },
    'M4':    { cbDiameter: 8.25, cbDepth: 4.0 },
    'M5':    { cbDiameter: 10.0, cbDepth: 5.0 },
    'M6':    { cbDiameter: 11.5, cbDepth: 6.0 },
    'M8':    { cbDiameter: 15.0, cbDepth: 8.0 },
    'M10':   { cbDiameter: 18.5, cbDepth: 10.0 },
    'M12':   { cbDiameter: 21.0, cbDepth: 12.0 },
    'M14':   { cbDiameter: 25.0, cbDepth: 14.0 },
    'M16':   { cbDiameter: 28.0, cbDepth: 16.0 },
    'M20':   { cbDiameter: 34.0, cbDepth: 20.0 }
};

/**
 * Metric flat head screw countersink sizes (ISO 10642 / DIN 7991)
 * Standard 90° countersink angle
 * Format: { csDiameter: countersink top diameter, csAngle: angle in degrees }
 */
export const METRIC_FLAT_HEAD_COUNTERSINK = {
    'M2':    { csDiameter: 4.4,  csAngle: 90 },
    'M2.5':  { csDiameter: 5.5,  csAngle: 90 },
    'M3':    { csDiameter: 6.72, csAngle: 90 },
    'M4':    { csDiameter: 9.18, csAngle: 90 },
    'M5':    { csDiameter: 11.18, csAngle: 90 },
    'M6':    { csDiameter: 13.44, csAngle: 90 },
    'M8':    { csDiameter: 17.92, csAngle: 90 },
    'M10':   { csDiameter: 22.40, csAngle: 90 },
    'M12':   { csDiameter: 26.88, csAngle: 90 },
    'M14':   { csDiameter: 30.24, csAngle: 90 },
    'M16':   { csDiameter: 33.60, csAngle: 90 },
    'M20':   { csDiameter: 40.32, csAngle: 90 }
};

// ==================== Imperial Standards (ANSI/ASME) ====================

/**
 * Imperial clearance holes
 * Format: { close: diameter, normal: diameter, loose: diameter } (in inches)
 */
export const IMPERIAL_CLEARANCE = {
    '#4':    { close: 0.120, normal: 0.128, loose: 0.136 },
    '#6':    { close: 0.144, normal: 0.152, loose: 0.166 },
    '#8':    { close: 0.170, normal: 0.177, loose: 0.199 },
    '#10':   { close: 0.196, normal: 0.206, loose: 0.228 },
    '1/4':   { close: 0.266, normal: 0.281, loose: 0.313 },
    '5/16':  { close: 0.328, normal: 0.344, loose: 0.375 },
    '3/8':   { close: 0.391, normal: 0.406, loose: 0.438 },
    '7/16':  { close: 0.453, normal: 0.469, loose: 0.500 },
    '1/2':   { close: 0.516, normal: 0.531, loose: 0.563 },
    '5/8':   { close: 0.641, normal: 0.656, loose: 0.688 },
    '3/4':   { close: 0.766, normal: 0.781, loose: 0.875 }
};

/**
 * Imperial tap drill sizes (UNC standard pitch, ~75% thread)
 * Format: { drill: diameter (inches), tpi: threads per inch }
 */
export const IMPERIAL_TAP_DRILL = {
    '#4':    { drill: 0.089, tpi: 40 },
    '#6':    { drill: 0.106, tpi: 32 },
    '#8':    { drill: 0.136, tpi: 32 },
    '#10':   { drill: 0.159, tpi: 24 },
    '1/4':   { drill: 0.201, tpi: 20 },
    '5/16':  { drill: 0.257, tpi: 18 },
    '3/8':   { drill: 0.316, tpi: 16 },
    '7/16':  { drill: 0.368, tpi: 14 },
    '1/2':   { drill: 0.422, tpi: 13 },
    '5/8':   { drill: 0.531, tpi: 11 },
    '3/4':   { drill: 0.656, tpi: 10 }
};

/**
 * Imperial socket head cap screw counterbore sizes
 * Format: { cbDiameter: counterbore diameter, cbDepth: head height } (in inches)
 */
export const IMPERIAL_SHCS_COUNTERBORE = {
    '#4':    { cbDiameter: 0.183, cbDepth: 0.112 },
    '#6':    { cbDiameter: 0.215, cbDepth: 0.138 },
    '#8':    { cbDiameter: 0.265, cbDepth: 0.164 },
    '#10':   { cbDiameter: 0.311, cbDepth: 0.190 },
    '1/4':   { cbDiameter: 0.406, cbDepth: 0.250 },
    '5/16':  { cbDiameter: 0.500, cbDepth: 0.312 },
    '3/8':   { cbDiameter: 0.594, cbDepth: 0.375 },
    '7/16':  { cbDiameter: 0.688, cbDepth: 0.438 },
    '1/2':   { cbDiameter: 0.781, cbDepth: 0.500 },
    '5/8':   { cbDiameter: 0.969, cbDepth: 0.625 },
    '3/4':   { cbDiameter: 1.156, cbDepth: 0.750 }
};

/**
 * Imperial flat head screw countersink (82° standard for US)
 * Format: { csDiameter: countersink top diameter, csAngle: angle } (in inches)
 */
export const IMPERIAL_FLAT_HEAD_COUNTERSINK = {
    '#4':    { csDiameter: 0.225, csAngle: 82 },
    '#6':    { csDiameter: 0.279, csAngle: 82 },
    '#8':    { csDiameter: 0.332, csAngle: 82 },
    '#10':   { csDiameter: 0.385, csAngle: 82 },
    '1/4':   { csDiameter: 0.507, csAngle: 82 },
    '5/16':  { csDiameter: 0.635, csAngle: 82 },
    '3/8':   { csDiameter: 0.762, csAngle: 82 },
    '7/16':  { csDiameter: 0.812, csAngle: 82 },
    '1/2':   { csDiameter: 0.875, csAngle: 82 },
    '5/8':   { csDiameter: 1.000, csAngle: 82 },
    '3/4':   { csDiameter: 1.125, csAngle: 82 }
};

// ==================== Helper Functions ====================

/**
 * Get hole parameters for a standard fastener
 * @param {string} size - Fastener size (e.g., 'M5', '#10', '1/4')
 * @param {string} type - Hole type: 'simple', 'counterbore', 'countersink', 'tap'
 * @param {string} fit - Fit type for clearance: 'close', 'normal', 'loose'
 * @param {boolean} metric - Whether size is metric (auto-detected if not specified)
 * @returns {Object} Hole parameters
 */
export function getStandardHoleParams(size, type = 'simple', fit = 'normal', metric = null) {
    // Auto-detect metric vs imperial
    if (metric === null) {
        metric = size.startsWith('M');
    }
    
    const result = {
        size,
        type,
        metric,
        unit: metric ? 'mm' : 'inch'
    };
    
    if (metric) {
        // Metric
        switch (type) {
            case 'simple':
            case 'clearance':
                const clearance = METRIC_CLEARANCE[size];
                if (!clearance) throw new Error(`Unknown metric size: ${size}`);
                result.diameter = clearance[fit] || clearance.normal;
                break;
                
            case 'counterbore':
            case 'cbore':
                const cbClearance = METRIC_CLEARANCE[size];
                const cbSpec = METRIC_SHCS_COUNTERBORE[size];
                if (!cbClearance || !cbSpec) throw new Error(`Unknown metric size: ${size}`);
                result.holeDiameter = cbClearance[fit] || cbClearance.normal;
                result.cbDiameter = cbSpec.cbDiameter;
                result.cbDepth = cbSpec.cbDepth;
                break;
                
            case 'countersink':
            case 'csink':
                const csClearance = METRIC_CLEARANCE[size];
                const csSpec = METRIC_FLAT_HEAD_COUNTERSINK[size];
                if (!csClearance || !csSpec) throw new Error(`Unknown metric size: ${size}`);
                result.holeDiameter = csClearance[fit] || csClearance.normal;
                result.csDiameter = csSpec.csDiameter;
                result.csAngle = csSpec.csAngle;
                break;
                
            case 'tap':
            case 'tapped':
                const tapSpec = METRIC_TAP_DRILL[size];
                if (!tapSpec) throw new Error(`Unknown metric size: ${size}`);
                result.holeDiameter = tapSpec.drill;
                result.pitch = tapSpec.pitch;
                result.threadSize = size;
                break;
                
            default:
                throw new Error(`Unknown hole type: ${type}`);
        }
    } else {
        // Imperial - convert to mm for internal use
        const toMM = (inches) => inches * 25.4;
        
        switch (type) {
            case 'simple':
            case 'clearance':
                const clearance = IMPERIAL_CLEARANCE[size];
                if (!clearance) throw new Error(`Unknown imperial size: ${size}`);
                result.diameter = toMM(clearance[fit] || clearance.normal);
                break;
                
            case 'counterbore':
            case 'cbore':
                const cbClearance = IMPERIAL_CLEARANCE[size];
                const cbSpec = IMPERIAL_SHCS_COUNTERBORE[size];
                if (!cbClearance || !cbSpec) throw new Error(`Unknown imperial size: ${size}`);
                result.holeDiameter = toMM(cbClearance[fit] || cbClearance.normal);
                result.cbDiameter = toMM(cbSpec.cbDiameter);
                result.cbDepth = toMM(cbSpec.cbDepth);
                break;
                
            case 'countersink':
            case 'csink':
                const csClearance = IMPERIAL_CLEARANCE[size];
                const csSpec = IMPERIAL_FLAT_HEAD_COUNTERSINK[size];
                if (!csClearance || !csSpec) throw new Error(`Unknown imperial size: ${size}`);
                result.holeDiameter = toMM(csClearance[fit] || csClearance.normal);
                result.csDiameter = toMM(csSpec.csDiameter);
                result.csAngle = csSpec.csAngle;
                break;
                
            case 'tap':
            case 'tapped':
                const tapSpec = IMPERIAL_TAP_DRILL[size];
                if (!tapSpec) throw new Error(`Unknown imperial size: ${size}`);
                result.holeDiameter = toMM(tapSpec.drill);
                result.tpi = tapSpec.tpi;
                result.pitch = 25.4 / tapSpec.tpi; // Convert TPI to mm pitch
                result.threadSize = size;
                break;
                
            default:
                throw new Error(`Unknown hole type: ${type}`);
        }
    }
    
    return result;
}

/**
 * List all available standard sizes
 * @param {boolean} metric - True for metric, false for imperial
 * @returns {string[]} Array of size names
 */
export function listStandardSizes(metric = true) {
    if (metric) {
        return Object.keys(METRIC_CLEARANCE);
    } else {
        return Object.keys(IMPERIAL_CLEARANCE);
    }
}

/**
 * Parse a thread specification string
 * @param {string} spec - Thread spec like 'M5x0.8' or '1/4-20'
 * @returns {Object} Parsed thread info
 */
export function parseThreadSpec(spec) {
    // Metric: M5, M5x0.8
    const metricMatch = spec.match(/^M(\d+(?:\.\d+)?)(x(\d+(?:\.\d+)?))?$/i);
    if (metricMatch) {
        const size = `M${metricMatch[1]}`;
        const pitch = metricMatch[3] ? parseFloat(metricMatch[3]) : METRIC_TAP_DRILL[size]?.pitch;
        return {
            metric: true,
            size,
            nominalDiameter: parseFloat(metricMatch[1]),
            pitch,
            spec: pitch ? `${size}x${pitch}` : size
        };
    }
    
    // Imperial: #10, #10-24, 1/4, 1/4-20
    const imperialMatch = spec.match(/^(#\d+|[\d\/]+)(-(\d+))?$/);
    if (imperialMatch) {
        const size = imperialMatch[1];
        const tpi = imperialMatch[3] ? parseInt(imperialMatch[3]) : IMPERIAL_TAP_DRILL[size]?.tpi;
        return {
            metric: false,
            size,
            tpi,
            pitch: tpi ? 25.4 / tpi : undefined,
            spec: tpi ? `${size}-${tpi}` : size
        };
    }
    
    throw new Error(`Cannot parse thread specification: ${spec}`);
}

export default {
    METRIC_CLEARANCE,
    METRIC_TAP_DRILL,
    METRIC_SHCS_COUNTERBORE,
    METRIC_FLAT_HEAD_COUNTERSINK,
    IMPERIAL_CLEARANCE,
    IMPERIAL_TAP_DRILL,
    IMPERIAL_SHCS_COUNTERBORE,
    IMPERIAL_FLAT_HEAD_COUNTERSINK,
    getStandardHoleParams,
    listStandardSizes,
    parseThreadSpec
};
