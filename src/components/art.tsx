import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { colors } from '@/lib/theme';

/** The sound-bars logo from the welcome screen. */
export function Logo({ size = 56 }: { size?: number }) {
  const bars = [0.35, 0.7, 1, 0.75, 0.45];
  const w = size / 9;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {bars.map((h, i) => {
        const bh = size * h;
        return (
          <Rect key={i} x={w * (1 + i * 1.6)} y={(size - bh) / 2} width={w} height={bh} rx={w / 2} fill={colors.primaryBright} />
        );
      })}
    </Svg>
  );
}

/** Practice pad with two sticks, as on the welcome screen. */
export function PadArt({ width = 260 }: { width?: number }) {
  const h = width * 0.62;
  return (
    <Svg width={width} height={h} viewBox="0 0 260 160">
      <Defs>
        <LinearGradient id="pad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#8E74FF" />
          <Stop offset="1" stopColor="#4B2FC4" />
        </LinearGradient>
        <LinearGradient id="glow" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#8E74FF" stopOpacity="0.5" />
          <Stop offset="1" stopColor="#8E74FF" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Ellipse cx="130" cy="135" rx="110" ry="18" fill="url(#glow)" />
      <Path d="M40 110 L80 70 L180 70 L220 110 Z" fill="url(#pad)" />
      <Path d="M40 110 L220 110 L214 122 L46 122 Z" fill="#3A238F" />
      <Path d="M70 100 L95 78 L165 78 L190 100 Z" fill="#A994FF" opacity={0.35} />
      <Line x1="20" y1="20" x2="110" y2="92" stroke="#D9CFFF" strokeWidth={7} strokeLinecap="round" />
      <Line x1="240" y1="20" x2="150" y2="92" stroke="#D9CFFF" strokeWidth={7} strokeLinecap="round" />
      <G stroke={colors.primaryBright} strokeWidth={4} strokeLinecap="round">
        <Line x1="130" y1="8" x2="130" y2="34" />
        <Line x1="100" y1="16" x2="110" y2="38" />
        <Line x1="160" y1="16" x2="150" y2="38" />
      </G>
    </Svg>
  );
}

/** Small drum-pad icon for the Home card. */
export function PadIcon({ size = 72 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72">
      <Defs>
        <LinearGradient id="pi" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#A68BFF" />
          <Stop offset="1" stopColor="#5B3FD6" />
        </LinearGradient>
      </Defs>
      <Path d="M8 38 L36 22 L64 38 L36 54 Z" fill="url(#pi)" />
      <Path d="M8 38 L36 54 L36 60 L8 44 Z" fill="#3A238F" />
      <Path d="M64 38 L36 54 L36 60 L64 44 Z" fill="#2B1A70" />
      <Path d="M20 38 L36 29 L52 38 L36 47 Z" fill="#C9BBFF" opacity={0.35} />
    </Svg>
  );
}

/** The friendly mascot on the result screen. Its mood follows the score. */
export function Mascot({ mood, size = 64 }: { mood: 'happy' | 'ok' | 'sad'; size?: number }) {
  const mouth =
    mood === 'happy' ? 'M24 40 Q32 50 40 40 Z' : mood === 'ok' ? 'M25 42 Q32 46 39 42' : 'M25 45 Q32 39 39 45';
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Circle cx="32" cy="34" r="22" fill={colors.teal} />
      <Circle cx="18" cy="12" r="4" fill={colors.teal} />
      <Line x1="20" y1="15" x2="24" y2="20" stroke={colors.teal} strokeWidth={3} />
      <Circle cx="46" cy="12" r="4" fill={colors.teal} />
      <Line x1="44" y1="15" x2="40" y2="20" stroke={colors.teal} strokeWidth={3} />
      <Circle cx="24" cy="30" r="5" fill="#fff" />
      <Circle cx="40" cy="30" r="5" fill="#fff" />
      <Circle cx="25" cy="31" r="2.4" fill="#132" />
      <Circle cx="41" cy="31" r="2.4" fill="#132" />
      <Path d={mouth} fill={mood === 'happy' ? '#132' : 'none'} stroke="#132" strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}
