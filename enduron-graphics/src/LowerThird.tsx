import {
  AbsoluteFill,
  Composition,
  Easing,
  interpolate,
  useCurrentFrame,
} from "remotion";

const FPS = 30;
const ENTER_FRAMES = 20;
const HOLD_FRAMES = 90;
const EXIT_FRAMES = 20;
const TOTAL_FRAMES = ENTER_FRAMES + HOLD_FRAMES + EXIT_FRAMES;

const OFFSCREEN_X = 900;

export const LowerThirdComposition = () => {
  return (
    <Composition
      id="LowerThird"
      component={LowerThird}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
    />
  );
};

export const LowerThird: React.FC = () => {
  const frame = useCurrentFrame();

  const x = interpolate(
    frame,
    [0, ENTER_FRAMES, ENTER_FRAMES + HOLD_FRAMES, TOTAL_FRAMES],
    [-OFFSCREEN_X, 0, 0, -OFFSCREEN_X],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "transparent" }}>
      <div
        style={{
          position: "absolute",
          left: 80,
          bottom: 140,
          transform: `translateX(${x}px)`,
          backgroundColor: "rgba(10, 10, 12, 0.85)",
          padding: "28px 48px",
          borderRadius: 6,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <span
          style={{
            fontFamily: "Arial, Helvetica, sans-serif",
            fontSize: 56,
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: 2,
            lineHeight: 1,
          }}
        >
          NATE BRAMLAGE
        </span>
        <span
          style={{
            fontFamily: "Arial, Helvetica, sans-serif",
            fontSize: 30,
            fontWeight: 400,
            color: "#e0e0e0",
            letterSpacing: 1,
            lineHeight: 1,
          }}
        >
          Enduron
        </span>
      </div>
    </AbsoluteFill>
  );
};
