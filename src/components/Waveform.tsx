import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '@/lib/theme';

/** Mirrored bar waveform: the live input level while a test runs. */
export function Waveform({
  values,
  width,
  height = 90,
  gain = 1,
}: {
  values: number[];
  width: number;
  height?: number;
  gain?: number;
}) {
  const n = values.length || 1;
  const step = width / n;
  const barW = Math.max(1, step * 0.55);
  const mid = height / 2;
  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="wf" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.primary} />
            <Stop offset="0.5" stopColor={colors.primaryBright} />
            <Stop offset="1" stopColor={colors.primary} />
          </LinearGradient>
        </Defs>
        {values.map((v, i) => {
          const h = Math.max(2, Math.min(1, v * gain) * (height - 4));
          return <Rect key={i} x={i * step} y={mid - h / 2} width={barW} height={h} rx={barW / 2} fill="url(#wf)" />;
        })}
      </Svg>
    </View>
  );
}
