import { describe, it, expect } from 'vitest';
import { hsvToRgb, rgbToHex, hexToHsv, colorToHs, channelIsOn } from '../homekit';
import type { ControlState, ChannelState } from '../wec';

function makeState(mint: number, channels: Array<Partial<ChannelState> & { fxn: number }>): ControlState {
  return {
    mint,
    e: channels.map(c => ({
      fxn: c.fxn, fx: c.fx ?? 'Glow', int: c.int ?? 100,
      spd: 50, trails: 0, amount: 10, spacing: 1, dir: 0, rot: 0,
      colors: c.colors ?? [{ c: 'ww' }],
    })),
  };
}

describe('hsvToRgb', () => {
  it('converts pure red (0°, 100%, 100%)', () => {
    expect(hsvToRgb(0, 100, 100)).toEqual([255, 0, 0]);
  });

  it('converts pure green (120°, 100%, 100%)', () => {
    expect(hsvToRgb(120, 100, 100)).toEqual([0, 255, 0]);
  });

  it('converts pure blue (240°, 100%, 100%)', () => {
    expect(hsvToRgb(240, 100, 100)).toEqual([0, 0, 255]);
  });

  it('converts white (any hue, 0% saturation, 100% value)', () => {
    expect(hsvToRgb(0, 0, 100)).toEqual([255, 255, 255]);
  });

  it('converts black (any hue, 100% value, 0% value)', () => {
    expect(hsvToRgb(0, 100, 0)).toEqual([0, 0, 0]);
  });

  it('converts yellow (60°, 100%, 100%)', () => {
    expect(hsvToRgb(60, 100, 100)).toEqual([255, 255, 0]);
  });

  it('converts cyan (180°, 100%, 100%)', () => {
    expect(hsvToRgb(180, 100, 100)).toEqual([0, 255, 255]);
  });

  it('converts magenta (300°, 100%, 100%)', () => {
    expect(hsvToRgb(300, 100, 100)).toEqual([255, 0, 255]);
  });

  it('converts 50% brightness grey', () => {
    const [r, g, b] = hsvToRgb(0, 0, 50);
    expect(r).toBeCloseTo(128, 0);
    expect(g).toBeCloseTo(128, 0);
    expect(b).toBeCloseTo(128, 0);
  });
});

describe('rgbToHex', () => {
  it('converts red', () => {
    expect(rgbToHex(255, 0, 0)).toBe('ff0000');
  });

  it('converts black', () => {
    expect(rgbToHex(0, 0, 0)).toBe('000000');
  });

  it('converts white', () => {
    expect(rgbToHex(255, 255, 255)).toBe('ffffff');
  });

  it('pads single-digit hex values', () => {
    expect(rgbToHex(1, 2, 3)).toBe('010203');
  });
});

describe('hexToHsv', () => {
  it('converts red hex', () => {
    expect(hexToHsv('ff0000')).toEqual([0, 100, 100]);
  });

  it('handles # prefix', () => {
    expect(hexToHsv('#ff0000')).toEqual([0, 100, 100]);
  });

  it('converts green hex', () => {
    expect(hexToHsv('00ff00')).toEqual([120, 100, 100]);
  });

  it('converts blue hex', () => {
    expect(hexToHsv('0000ff')).toEqual([240, 100, 100]);
  });

  it('converts black', () => {
    expect(hexToHsv('000000')).toEqual([0, 0, 0]);
  });

  it('converts white', () => {
    expect(hexToHsv('ffffff')).toEqual([0, 0, 100]);
  });

  it('roundtrips with hsvToRgb+rgbToHex', () => {
    const [r, g, b] = hsvToRgb(200, 80, 90);
    const hex = rgbToHex(r, g, b);
    const [h, s, v] = hexToHsv(hex);
    expect(h).toBeCloseTo(200, -1); // within ~10 degrees due to rounding
    expect(s).toBeCloseTo(80, -1);
    expect(v).toBeCloseTo(90, -1);
  });
});

describe('colorToHs', () => {
  it('maps warm white to warm hue/saturation', () => {
    const [h, s] = colorToHs('ww');
    expect(h).toBe(38);
    expect(s).toBe(30);
  });

  it('maps cool white to cool hue/saturation', () => {
    const [h, s] = colorToHs('cw');
    expect(h).toBe(210);
    expect(s).toBe(10);
  });

  it('maps none to zero', () => {
    expect(colorToHs('none')).toEqual([0, 0]);
  });

  it('maps a hex color to hue/saturation', () => {
    const [h, s] = colorToHs('ff0000');
    expect(h).toBe(0);
    expect(s).toBe(100);
  });

  it('maps blue hex to correct hue', () => {
    const [h] = colorToHs('0000ff');
    expect(h).toBe(240);
  });
});

describe('channelIsOn', () => {
  it('is on when master>0, effect active, brightness>0', () => {
    const s = makeState(100, [{ fxn: 1, fx: 'Glow', int: 100 }]);
    expect(channelIsOn(s, 1)).toBe(true);
  });

  it('is off when master brightness is 0', () => {
    const s = makeState(0, [{ fxn: 1, fx: 'Glow', int: 100 }]);
    expect(channelIsOn(s, 1)).toBe(false);
  });

  it('is off when the channel effect is "Off" even if int>0', () => {
    const s = makeState(100, [{ fxn: 2, fx: 'Off', int: 100 }]);
    expect(channelIsOn(s, 2)).toBe(false);
  });

  it('is off when channel brightness is 0', () => {
    const s = makeState(100, [{ fxn: 1, fx: 'Glow', int: 0 }]);
    expect(channelIsOn(s, 1)).toBe(false);
  });

  it('is false for a missing channel or null state', () => {
    const s = makeState(100, [{ fxn: 1 }]);
    expect(channelIsOn(s, 2)).toBe(false);
    expect(channelIsOn(null, 1)).toBe(false);
  });
});
