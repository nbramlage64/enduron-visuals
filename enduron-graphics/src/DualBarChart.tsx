import {
  AbsoluteFill,
  Composition,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
} from "remotion";

const FPS = 30;

const ROW_STAGGER = 6;
const COLUMN_STAGGER = 6;
const ENTRANCE_FRAMES = 10;
const FILL_DELAY = 3;
const FILL_SETTLE_FRAMES = 40;
const HOLD_FRAMES = 45;

const BOTTOM_PHASE_FRAMES =
  4 * ROW_STAGGER + FILL_DELAY + FILL_SETTLE_FRAMES + 10;
const TOP_PHASE_START = BOTTOM_PHASE_FRAMES;
const TOP_PHASE_FRAMES =
  4 * COLUMN_STAGGER + FILL_DELAY + FILL_SETTLE_FRAMES + 10;
const TOTAL_FRAMES = TOP_PHASE_START + TOP_PHASE_FRAMES + HOLD_FRAMES;

const FILL_SPRING_CONFIG = { damping: 9, mass: 0.7, stiffness: 120 };
const FONT = "Arial, Helvetica, sans-serif";

export type DualBarChartItem = {
  label: string;
  value: number;
  color: string;
};

export type DualBarChartProps = {
  items: DualBarChartItem[];
  backgroundColor: string;
  trackColor: string;
};

const defaultItems: DualBarChartItem[] = [
  { label: "Title A", value: 60, color: "#8a95a5" },
  { label: "Title B", value: 20, color: "#5c6b7a" },
  { label: "Title C", value: 100, color: "#7a8a80" },
  { label: "Title D", value: 40, color: "#9c8f7a" },
  { label: "Title E", value: 80, color: "#6b7280" },
];

export const DualBarChartComposition = () => {
  return (
    <Composition
      id="DualBarChart"
      component={DualBarChart}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{
        items: defaultItems,
        backgroundColor: "#141417",
        trackColor: "rgba(255,255,255,0.08)",
      }}
    />
  );
};

export const DualBarChart: React.FC<DualBarChartProps> = ({
  items,
  backgroundColor,
  trackColor,
}) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ backgroundColor }}>
      <AbsoluteFill
        style={{
          top: 0,
          height: 540,
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 56,
          paddingBottom: 48,
        }}
      >
        {items.map((item, index) => {
          const entranceStart = TOP_PHASE_START + index * COLUMN_STAGGER;
          const fillStart = entranceStart + FILL_DELAY;
          return (
            <BarColumn
              key={item.label}
              item={item}
              trackColor={trackColor}
              frame={frame}
              entranceStart={entranceStart}
              fillStart={fillStart}
            />
          );
        })}
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          top: 540,
          height: 540,
          flexDirection: "column",
          justifyContent: "center",
          gap: 28,
          paddingLeft: 140,
          paddingRight: 140,
        }}
      >
        {items.map((item, index) => {
          const reverseIndex = items.length - 1 - index;
          const entranceStart = reverseIndex * ROW_STAGGER;
          const fillStart = entranceStart + FILL_DELAY;
          return (
            <BarRow
              key={item.label}
              item={item}
              trackColor={trackColor}
              frame={frame}
              entranceStart={entranceStart}
              fillStart={fillStart}
            />
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

type BarProps = {
  item: DualBarChartItem;
  trackColor: string;
  frame: number;
  entranceStart: number;
  fillStart: number;
};

const useEntranceProgress = (frame: number, entranceStart: number) =>
  interpolate(frame, [entranceStart, entranceStart + ENTRANCE_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

const useFillPercent = (frame: number, fillStart: number, value: number) => {
  const fillSpring = spring({
    frame: Math.max(0, frame - fillStart),
    fps: FPS,
    config: FILL_SPRING_CONFIG,
  });
  return fillSpring * value;
};

const BarRow: React.FC<BarProps> = ({
  item,
  trackColor,
  frame,
  entranceStart,
  fillStart,
}) => {
  const entranceProgress = useEntranceProgress(frame, entranceStart);
  const widthPercent = useFillPercent(frame, fillStart, item.value);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 24,
        opacity: entranceProgress,
        transform: `translateY(${(1 - entranceProgress) * 16}px) scale(${
          0.9 + entranceProgress * 0.1
        })`,
      }}
    >
      <div
        style={{
          width: 260,
          textAlign: "right",
          fontFamily: FONT,
          fontSize: 32,
          fontWeight: 600,
          color: "#e5e5e5",
        }}
      >
        {item.label}
      </div>
      <div
        style={{
          flex: 1,
          height: 56,
          borderRadius: 28,
          backgroundColor: trackColor,
          overflow: "hidden",
          display: "flex",
        }}
      >
        <div
          style={{
            width: `${widthPercent}%`,
            height: "100%",
            borderRadius: 28,
            backgroundColor: item.color,
          }}
        />
      </div>
      <div
        style={{
          width: 110,
          fontFamily: FONT,
          fontSize: 34,
          fontWeight: 700,
          color: "#ffffff",
          opacity: entranceProgress,
        }}
      >
        {Math.round(item.value)}%
      </div>
    </div>
  );
};

const BarColumn: React.FC<BarProps> = ({
  item,
  trackColor,
  frame,
  entranceStart,
  fillStart,
}) => {
  const entranceProgress = useEntranceProgress(frame, entranceStart);
  const heightPercent = useFillPercent(frame, fillStart, item.value);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        opacity: entranceProgress,
        transform: `translateY(${(1 - entranceProgress) * 16}px) scale(${
          0.9 + entranceProgress * 0.1
        })`,
      }}
    >
      <div
        style={{
          fontFamily: FONT,
          fontSize: 34,
          fontWeight: 700,
          color: "#ffffff",
        }}
      >
        {Math.round(item.value)}%
      </div>
      <div
        style={{
          width: 64,
          height: 340,
          borderRadius: 32,
          backgroundColor: trackColor,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
        }}
      >
        <div
          style={{
            width: "100%",
            height: `${heightPercent}%`,
            borderRadius: 32,
            backgroundColor: item.color,
          }}
        />
      </div>
      <div
        style={{
          width: 140,
          textAlign: "center",
          fontFamily: FONT,
          fontSize: 28,
          fontWeight: 600,
          color: "#e5e5e5",
        }}
      >
        {item.label}
      </div>
    </div>
  );
};
