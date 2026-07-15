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

// Frames (after a bar's fill starts) until the spring first reaches 100% —
// this is the "impact" moment the landing-glow pulse is timed against.
// Derived by sampling the spring itself so it always tracks
// FILL_SPRING_CONFIG if that config changes.
const IMPACT_OFFSET = (() => {
  for (let f = 0; f <= 90; f += 1) {
    if (spring({ frame: f, fps: FPS, config: FILL_SPRING_CONFIG }) >= 1) {
      return f;
    }
  }
  return 24;
})();
const PULSE_DECAY_FRAMES = 16;

// ---- Layout ----
const CANVAS_WIDTH = 1920;

const ROW_TRACK_HEIGHT = 56;
const COLUMN_TRACK_WIDTH = 64;
const COLUMN_TRACK_HEIGHT = 340;

const TOP_AREA_HEIGHT = 540;
const TOP_BOTTOM_PADDING = 48;
const TOP_VALUE_BLOCK = 46;
const TOP_LABEL_BLOCK = 40;
const TOP_GAP = 14;
// Bars are bottom-anchored, so the track's bottom edge only depends on what
// sits below it (label block + one gap + the section's own bottom padding).
const TOP_TRACK_BOTTOM =
  TOP_AREA_HEIGHT - TOP_BOTTOM_PADDING - TOP_LABEL_BLOCK - TOP_GAP;

const BOTTOM_AREA_HEIGHT = 540;
const BOTTOM_PADDING_X = 140;
const BOTTOM_LABEL_WIDTH = 260;
const BOTTOM_VALUE_WIDTH = 110;
const BOTTOM_GAP = 24;
const BOTTOM_TRACK_LEFT = BOTTOM_PADDING_X + BOTTOM_LABEL_WIDTH + BOTTOM_GAP;
const BOTTOM_TRACK_WIDTH =
  CANVAS_WIDTH -
  BOTTOM_TRACK_LEFT -
  (BOTTOM_PADDING_X + BOTTOM_VALUE_WIDTH + BOTTOM_GAP);

const GRID_VALUES = [0, 20, 40, 60, 80, 100];

// ---- Theme ----
// All colors and styling constants live here — swap these for Enduron's
// brand palette without touching component logic below.
const THEME = {
  background: "linear-gradient(160deg, #1a2036 0%, #10131c 55%, #08090d 100%)",
  grid: {
    lineColor: "rgba(255,255,255,0.07)",
    labelColor: "rgba(255,255,255,0.32)",
  },
  track: {
    // Combined with each instance's `trackColor` prop to form the recessed
    // groove gradient.
    highlight: "rgba(255,255,255,0.05)",
    innerShadow:
      "inset 0 2px 6px rgba(0,0,0,0.6), inset 0 -1px 0 rgba(255,255,255,0.05)",
  },
  text: {
    titleColor: "rgba(230,230,238,0.85)",
    titleWeight: 500,
    valueWeight: 800,
    letterSpacing: "-0.02em",
    dropShadow: "0 2px 8px rgba(0,0,0,0.5)",
  },
  glow: {
    blur: 26,
    opacity: 0.6,
  },
  sheen: {
    height: 4,
    opacity: 0.4,
  },
  pulse: {
    blurBoost: 34,
    opacityBoost: 0.55,
  },
};

const gradientCss = (gradient: { from: string; to: string }, angleDeg: number) =>
  `linear-gradient(${angleDeg}deg, ${gradient.from}, ${gradient.to})`;

export type DualBarChartItem = {
  label: string;
  value: number;
  gradient: { from: string; to: string };
};

export type DualBarChartProps = {
  items: DualBarChartItem[];
  backgroundColor: string;
  trackColor: string;
};

const defaultItems: DualBarChartItem[] = [
  { label: "Title A", value: 60, gradient: { from: "#ff5f6d", to: "#ffb56b" } },
  { label: "Title B", value: 20, gradient: { from: "#0f9b8e", to: "#6ee7b7" } },
  { label: "Title C", value: 100, gradient: { from: "#f5a623", to: "#ffe27a" } },
  { label: "Title D", value: 40, gradient: { from: "#2b8fd8", to: "#7ee8fa" } },
  { label: "Title E", value: 80, gradient: { from: "#8e2de2", to: "#e94584" } },
];

export const DualBarChartComposition = () => {
  return (
    <Composition
      id="DualBarChart"
      component={DualBarChart}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={CANVAS_WIDTH}
      height={1080}
      defaultProps={{
        items: defaultItems,
        backgroundColor: THEME.background,
        trackColor: "rgba(0,0,0,0.32)",
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
    <AbsoluteFill style={{ background: backgroundColor }}>
      <AbsoluteFill
        style={{
          top: 0,
          height: TOP_AREA_HEIGHT,
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 56,
          paddingBottom: TOP_BOTTOM_PADDING,
        }}
      >
        <TopGridLines />
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
          top: TOP_AREA_HEIGHT,
          height: BOTTOM_AREA_HEIGHT,
          flexDirection: "column",
          justifyContent: "center",
          gap: 28,
          paddingLeft: BOTTOM_PADDING_X,
          paddingRight: BOTTOM_PADDING_X,
        }}
      >
        <BottomGridLines />
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

const TopGridLines: React.FC = () => (
  <>
    {GRID_VALUES.map((v) => {
      const y = TOP_TRACK_BOTTOM - (v / 100) * COLUMN_TRACK_HEIGHT;
      return (
        <div key={v} style={{ position: "absolute", left: 0, right: 0, top: y }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              height: 1,
              backgroundColor: THEME.grid.lineColor,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 40,
              top: -18,
              fontFamily: FONT,
              fontSize: 15,
              color: THEME.grid.labelColor,
            }}
          >
            {v}
          </div>
        </div>
      );
    })}
  </>
);

const BottomGridLines: React.FC = () => (
  <>
    {GRID_VALUES.map((v) => {
      const x = BOTTOM_TRACK_LEFT + (v / 100) * BOTTOM_TRACK_WIDTH;
      return (
        <div key={v} style={{ position: "absolute", top: 0, bottom: 0, left: x }}>
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              width: 1,
              backgroundColor: THEME.grid.lineColor,
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 8,
              left: 0,
              transform: "translateX(-50%)",
              fontFamily: FONT,
              fontSize: 15,
              color: THEME.grid.labelColor,
            }}
          >
            {v}
          </div>
        </div>
      );
    })}
  </>
);

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

const usePulseProgress = (frame: number, fillStart: number) => {
  const impactFrame = fillStart + IMPACT_OFFSET;
  return interpolate(
    frame,
    [impactFrame - 1, impactFrame, impactFrame + PULSE_DECAY_FRAMES],
    [0, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );
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
  const pulse = usePulseProgress(frame, fillStart);
  const radius = ROW_TRACK_HEIGHT / 2;

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
          width: BOTTOM_LABEL_WIDTH,
          textAlign: "right",
          fontFamily: FONT,
          fontSize: 32,
          fontWeight: THEME.text.titleWeight,
          color: THEME.text.titleColor,
          textShadow: THEME.text.dropShadow,
        }}
      >
        {item.label}
      </div>
      <div style={{ position: "relative", flex: 1, height: ROW_TRACK_HEIGHT }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            width: `${widthPercent}%`,
            borderRadius: radius,
            background: gradientCss(item.gradient, 90),
            filter: `blur(${THEME.glow.blur + pulse * THEME.pulse.blurBoost}px)`,
            opacity: THEME.glow.opacity + pulse * THEME.pulse.opacityBoost,
          }}
        />
        <div
          style={{
            position: "relative",
            height: "100%",
            borderRadius: radius,
            background: `linear-gradient(180deg, ${THEME.track.highlight}, ${trackColor})`,
            boxShadow: THEME.track.innerShadow,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "relative",
              width: `${widthPercent}%`,
              height: "100%",
              borderRadius: radius,
              background: gradientCss(item.gradient, 90),
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: THEME.sheen.height,
                borderRadius: radius,
                background: `linear-gradient(to bottom, rgba(255,255,255,${THEME.sheen.opacity}), transparent)`,
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: radius,
                background: "#ffffff",
                mixBlendMode: "screen",
                opacity: pulse * THEME.pulse.opacityBoost,
              }}
            />
          </div>
        </div>
      </div>
      <div
        style={{
          width: BOTTOM_VALUE_WIDTH,
          fontFamily: FONT,
          fontSize: 42,
          fontWeight: THEME.text.valueWeight,
          letterSpacing: THEME.text.letterSpacing,
          background: gradientCss(item.gradient, 90),
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.45))",
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
  const pulse = usePulseProgress(frame, fillStart);
  const radius = COLUMN_TRACK_WIDTH / 2;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: TOP_GAP,
        opacity: entranceProgress,
        transform: `translateY(${(1 - entranceProgress) * 16}px) scale(${
          0.9 + entranceProgress * 0.1
        })`,
      }}
    >
      <div
        style={{
          height: TOP_VALUE_BLOCK,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          fontFamily: FONT,
          fontSize: 38,
          fontWeight: THEME.text.valueWeight,
          letterSpacing: THEME.text.letterSpacing,
          background: gradientCss(item.gradient, 0),
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.45))",
        }}
      >
        {Math.round(item.value)}%
      </div>
      <div
        style={{
          position: "relative",
          width: COLUMN_TRACK_WIDTH,
          height: COLUMN_TRACK_HEIGHT,
        }}
      >
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "100%",
            height: `${heightPercent}%`,
            borderRadius: radius,
            background: gradientCss(item.gradient, 0),
            filter: `blur(${THEME.glow.blur + pulse * THEME.pulse.blurBoost}px)`,
            opacity: THEME.glow.opacity + pulse * THEME.pulse.opacityBoost,
          }}
        />
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: radius,
            background: `linear-gradient(180deg, ${THEME.track.highlight}, ${trackColor})`,
            boxShadow: THEME.track.innerShadow,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              height: `${heightPercent}%`,
              borderRadius: radius,
              background: gradientCss(item.gradient, 0),
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: THEME.sheen.height,
                borderRadius: radius,
                background: `linear-gradient(to bottom, rgba(255,255,255,${THEME.sheen.opacity}), transparent)`,
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: radius,
                background: "#ffffff",
                mixBlendMode: "screen",
                opacity: pulse * THEME.pulse.opacityBoost,
              }}
            />
          </div>
        </div>
      </div>
      <div
        style={{
          height: TOP_LABEL_BLOCK,
          width: 140,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          textAlign: "center",
          fontFamily: FONT,
          fontSize: 26,
          fontWeight: THEME.text.titleWeight,
          color: THEME.text.titleColor,
          textShadow: THEME.text.dropShadow,
        }}
      >
        {item.label}
      </div>
    </div>
  );
};
