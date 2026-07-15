import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { useCallback, useMemo } from "react";
import {
  AbsoluteFill,
  Composition,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import * as THREE from "three";

const FPS = 30;
const SCENE1_END_FRAME = 90; // 3.0s — orbit finishes
const SCENE2A_END_FRAME = 135; // 4.5s — camera reaches overhead
const TOTAL_FRAMES = 180; // 6.0s

const ROOF_FADE_START = 129; // 4.3s
const ROOF_FADE_END = 141; // 4.7s
const LABEL_FADE_START = 141; // 4.7s
const LABEL_FADE_END = 159; // 5.3s

const CAMERA_FOV = 45;

const FONT = "Arial, Helvetica, sans-serif";
const BACKGROUND_GRADIENT =
  "radial-gradient(circle at 50% 30%, #ffffff 0%, #eeeeec 55%, #d9d9d5 100%)";

// Trailer body: 13-unit box (X: -8..5) + 3-unit nose wedge (X: 5..8) = 16 units long.
const TRAILER_LENGTH = 13;
const TRAILER_WIDTH = 6;
const TRAILER_HEIGHT = 6.5;
const BODY_CENTER_X = -1.5;
const NOSE_BASE_X = 5;
const NOSE_TIP_X = 8;

// Dark but not pure black, with a little gloss so direct/rim lights read
// as highlights instead of the surface going flat.
const TRAILER_MATERIAL_PROPS = {
  color: "#141414",
  roughness: 0.35,
  metalness: 0.25,
  flatShading: true,
  side: THREE.DoubleSide,
} as const;

// Wheels: tandem axle near the rear, tucked just outside the side walls.
const WHEEL_RADIUS = 0.9;
const WHEEL_THICKNESS = 0.45;
const WHEEL_X_POSITIONS = [-6, -4.4];
const WHEEL_Z = TRAILER_WIDTH / 2 + WHEEL_THICKNESS / 2 - 0.1;
const WHEEL_MATERIAL_PROPS = {
  color: "#111111",
  roughness: 1,
  metalness: 0,
  flatShading: true,
} as const;

// ---- Fresnel rim light -------------------------------------------------
// Injected into meshStandardMaterial's shader so silhouette edges catch a
// glancing-angle highlight and separate from the light background, without
// needing a full env map or a second inverted-hull mesh.
type FresnelRimOptions = {
  color?: string;
  power?: number;
  intensity?: number;
};

const applyFresnelRim = (
  material: THREE.Material,
  { color = "#ffffff", power = 2.5, intensity = 0.35 }: FresnelRimOptions = {},
) => {
  const rimColor = new THREE.Color(color);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = { value: rimColor };
    shader.uniforms.rimPower = { value: power };
    shader.uniforms.rimIntensity = { value: intensity };

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "void main() {",
        `uniform vec3 rimColor;
uniform float rimPower;
uniform float rimIntensity;
void main() {`,
      )
      .replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
  float rimFresnel = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), rimPower);
  gl_FragColor.rgb += rimColor * rimFresnel * rimIntensity;`,
      );
  };
};

// A material only compiles its shader once, so the rim effect must be
// patched onto each instance exactly once via a ref, then forced to recompile.
const useRimMaterialRef = (options?: FresnelRimOptions) =>
  useCallback(
    (material: THREE.Material | null) => {
      if (material && !material.userData.rimApplied) {
        applyFresnelRim(material, options);
        material.userData.rimApplied = true;
        material.needsUpdate = true;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

// ---- Camera path -----------------------------------------------------
// Scene 1 (0 -> 3s): orbit at fixed radius/height around the trailer.
const ORBIT_RADIUS = 20;
const ORBIT_HEIGHT = 9;
const ORBIT_START_DEG = 50; // front-quarter / corner view
const ORBIT_END_DEG = 0; // pure side view
const ORBIT_TARGET: Vec3 = [0, 3, 0];

// Scene 2a (3 -> 4.5s): rise up and over the trailer.
const SIDE_POS: Vec3 = [0, ORBIT_HEIGHT, ORBIT_RADIUS];
const OVERHEAD_POS: Vec3 = [0, 16, 0];
const OVERHEAD_TARGET: Vec3 = [0, 0, 0];

// Scene 2b (4.5 -> 6s): descend straight down into the interior.
const INTERIOR_POS: Vec3 = [0, 3, 0];
const INTERIOR_TARGET: Vec3 = [4, 2, 0];

type Vec3 = [number, number, number];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

const easeProgress = (frame: number, start: number, end: number) =>
  interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

// The overhead keyframe (camera directly above the trailer, looking
// straight down) has a view direction exactly parallel to world "up" —
// a singularity where lookAt()'s derived roll is undefined and can flip
// discontinuously if recomputed independently every frame. To avoid any
// snap, we compute the quaternion at each keyframe exactly once and
// smoothly slerp between those fixed orientations through the transition,
// rather than calling lookAt() fresh on every frame near the pole.
const lookAtQuaternion = (position: Vec3, target: Vec3): THREE.Quaternion => {
  // Must be a camera: Object3D.lookAt() points a plain object's +Z at the
  // target, while a camera's -Z points at it — using a plain Object3D here
  // silently produces a quaternion facing exactly backwards.
  const helper = new THREE.PerspectiveCamera();
  helper.position.set(...position);
  helper.up.set(0, 1, 0);
  helper.lookAt(...target);
  return helper.quaternion.clone();
};

const Q_SIDE = lookAtQuaternion(SIDE_POS, ORBIT_TARGET);
const Q_OVERHEAD = lookAtQuaternion(OVERHEAD_POS, OVERHEAD_TARGET);
const Q_INTERIOR = lookAtQuaternion(INTERIOR_POS, INTERIOR_TARGET);

const getCameraPose = (
  frame: number,
): { position: Vec3; quaternion: THREE.Quaternion } => {
  if (frame <= SCENE1_END_FRAME) {
    const t = easeProgress(frame, 0, SCENE1_END_FRAME);
    const deg = lerp(ORBIT_START_DEG, ORBIT_END_DEG, t);
    const rad = (deg * Math.PI) / 180;
    const position: Vec3 = [
      ORBIT_RADIUS * Math.sin(rad),
      ORBIT_HEIGHT,
      ORBIT_RADIUS * Math.cos(rad),
    ];
    // Target is fixed and the view stays well clear of vertical here, so a
    // fresh per-frame lookAt is stable — this is not the risky segment.
    return { position, quaternion: lookAtQuaternion(position, ORBIT_TARGET) };
  }
  if (frame <= SCENE2A_END_FRAME) {
    const t = easeProgress(frame, SCENE1_END_FRAME, SCENE2A_END_FRAME);
    return {
      position: lerp3(SIDE_POS, OVERHEAD_POS, t),
      quaternion: new THREE.Quaternion().copy(Q_SIDE).slerp(Q_OVERHEAD, t),
    };
  }
  const t = easeProgress(frame, SCENE2A_END_FRAME, TOTAL_FRAMES);
  return {
    position: lerp3(OVERHEAD_POS, INTERIOR_POS, t),
    quaternion: new THREE.Quaternion().copy(Q_OVERHEAD).slerp(Q_INTERIOR, t),
  };
};

// ---- Interior placeholder layout --------------------------------------
type InteriorLabel = {
  text: string;
  anchor: Vec3;
};

const GENERATOR_POS: Vec3 = [-5, 1, -1.5];
const GENERATOR_SIZE: Vec3 = [3, 2, 2];

const TANK_POS: Vec3 = [-1.8, 1.5, 1.5];
const TANK_RADIUS = 1;
const TANK_HEIGHT = 3;

const UTILITY_A_POS: Vec3 = [1.4, 0.75, -1.5];
const UTILITY_A_SIZE: Vec3 = [2, 1.5, 1.5];

const UTILITY_B_POS: Vec3 = [4, 0.65, 1.5];
const UTILITY_B_SIZE: Vec3 = [1.3, 1.3, 1.3];

const INTERIOR_LABELS: InteriorLabel[] = [
  { text: "Generator", anchor: [GENERATOR_POS[0], GENERATOR_SIZE[1] + 0.4, GENERATOR_POS[2]] },
  { text: "Water Tank", anchor: [TANK_POS[0], TANK_HEIGHT + 0.4, TANK_POS[2]] },
  { text: "Utility Equipment", anchor: [UTILITY_A_POS[0], UTILITY_A_SIZE[1] + 0.4, UTILITY_A_POS[2]] },
  { text: "Utility Equipment", anchor: [UTILITY_B_POS[0], UTILITY_B_SIZE[1] + 0.4, UTILITY_B_POS[2]] },
];

export const TrailerFlythroughComposition = () => {
  return (
    <Composition
      id="TrailerFlythrough"
      component={TrailerFlythrough}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
    />
  );
};

export const TrailerFlythrough: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const { position, quaternion } = getCameraPose(frame);

  const roofOpacity = interpolate(
    frame,
    [ROOF_FADE_START, ROOF_FADE_END],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const labelOpacity = interpolate(
    frame,
    [LABEL_FADE_START, LABEL_FADE_END],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const labels = INTERIOR_LABELS.map((item) => {
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, width / height, 0.1, 500);
    camera.position.set(...position);
    camera.quaternion.copy(quaternion);
    camera.updateMatrixWorld();
    const projected = new THREE.Vector3(...item.anchor).project(camera);
    return {
      text: item.text,
      x: (projected.x * 0.5 + 0.5) * width,
      y: (-projected.y * 0.5 + 0.5) * height,
      visible: projected.z < 1 && projected.z > -1,
    };
  });

  return (
    <AbsoluteFill style={{ background: BACKGROUND_GRADIENT }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ fov: CAMERA_FOV, near: 0.1, far: 500 }}
        gl={{ alpha: true, antialias: true }}
      >
        <CameraRig position={position} quaternion={quaternion} />
        <ambientLight intensity={0.2} />
        {/* Key: main light source, upper front-quarter */}
        <directionalLight position={[10, 18, 14]} intensity={1.4} color="#ffffff" />
        {/* Fill: softer, lower/front angle on the visible faces, lifts them off pure black */}
        <directionalLight position={[6, 5, 18]} intensity={0.4} color="#b7c9db" />
        {/* Fill 2: opposite side, keeps the hidden faces from going fully black */}
        <directionalLight position={[-14, 9, -8]} intensity={0.3} color="#a9c0d6" />
        {/* Rim: behind/to the side, grazes the visible silhouette + roofline edges */}
        <directionalLight position={[-6, 12, -20]} intensity={0.85} color="#dce8f5" />
        <TrailerBody roofOpacity={roofOpacity} />
        <InteriorProps />
      </ThreeCanvas>
      {labels.map((label, index) => (
        <div
          key={`${label.text}-${index}`}
          style={{
            position: "absolute",
            left: label.x,
            top: label.y,
            transform: "translate(-50%, -100%)",
            opacity: label.visible ? labelOpacity : 0,
            color: "#f2f2f0",
            fontFamily: FONT,
            fontSize: 22,
            fontWeight: 600,
            textShadow: "0 1px 4px rgba(0,0,0,0.8)",
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {label.text}
        </div>
      ))}
    </AbsoluteFill>
  );
};

const CameraRig: React.FC<{ position: Vec3; quaternion: THREE.Quaternion }> = ({
  position,
  quaternion,
}) => {
  const camera = useThree((state) => state.camera);
  camera.position.set(...position);
  camera.quaternion.copy(quaternion);
  camera.updateProjectionMatrix();
  return null;
};

const TrailerBody: React.FC<{ roofOpacity: number }> = ({ roofOpacity }) => {
  const noseGeometry = useNoseGeometry();
  const rimRef = useRimMaterialRef({ color: "#e7ecf2", power: 2.4, intensity: 0.45 });

  return (
    <group>
      {/* Floor */}
      <mesh
        position={[BODY_CENTER_X, 0, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[TRAILER_LENGTH, TRAILER_WIDTH]} />
        <meshStandardMaterial {...TRAILER_MATERIAL_PROPS} ref={rimRef} />
      </mesh>

      {/* Left wall (-Z) */}
      <mesh
        position={[BODY_CENTER_X, TRAILER_HEIGHT / 2, -TRAILER_WIDTH / 2]}
        rotation={[0, Math.PI, 0]}
      >
        <planeGeometry args={[TRAILER_LENGTH, TRAILER_HEIGHT]} />
        <meshStandardMaterial {...TRAILER_MATERIAL_PROPS} ref={rimRef} />
      </mesh>

      {/* Right wall (+Z) */}
      <mesh position={[BODY_CENTER_X, TRAILER_HEIGHT / 2, TRAILER_WIDTH / 2]}>
        <planeGeometry args={[TRAILER_LENGTH, TRAILER_HEIGHT]} />
        <meshStandardMaterial {...TRAILER_MATERIAL_PROPS} ref={rimRef} />
      </mesh>

      {/* Back wall (-X, rear of trailer) */}
      <mesh
        position={[-8, TRAILER_HEIGHT / 2, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <planeGeometry args={[TRAILER_WIDTH, TRAILER_HEIGHT]} />
        <meshStandardMaterial {...TRAILER_MATERIAL_PROPS} ref={rimRef} />
      </mesh>

      {/* Front wall (+X, nose attaches here) */}
      <mesh
        position={[NOSE_BASE_X, TRAILER_HEIGHT / 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <planeGeometry args={[TRAILER_WIDTH, TRAILER_HEIGHT]} />
        <meshStandardMaterial {...TRAILER_MATERIAL_PROPS} ref={rimRef} />
      </mesh>

      {/* Roof — fades out once the camera crests overhead */}
      <mesh
        position={[BODY_CENTER_X, TRAILER_HEIGHT, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[TRAILER_LENGTH, TRAILER_WIDTH]} />
        <meshStandardMaterial
          {...TRAILER_MATERIAL_PROPS}
          ref={rimRef}
          transparent
          opacity={roofOpacity}
          depthWrite={roofOpacity > 0.02}
        />
      </mesh>

      {/* V-nose wedge */}
      <mesh geometry={noseGeometry}>
        <meshStandardMaterial {...TRAILER_MATERIAL_PROPS} ref={rimRef} />
      </mesh>

      <PanelSeams />

      {/* Wheels */}
      {WHEEL_X_POSITIONS.flatMap((x) =>
        [-1, 1].map((side) => (
          <mesh
            key={`wheel-${x}-${side}`}
            position={[x, -WHEEL_RADIUS * 0.6, side * WHEEL_Z]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry
              args={[WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_THICKNESS, 16]}
            />
            <meshStandardMaterial {...WHEEL_MATERIAL_PROPS} />
          </mesh>
        )),
      )}
    </group>
  );
};

// Subtle recessed seam lines on the two long side walls, suggesting panel
// joints — thin, slightly darker strips offset just off the wall surface.
const SEAM_X_POSITIONS = [-5.5, -1.5, 2.5];
const SEAM_MATERIAL_PROPS = {
  color: "#080808",
  roughness: 0.6,
  metalness: 0,
} as const;

const PanelSeams: React.FC = () => (
  <group>
    {SEAM_X_POSITIONS.flatMap((x) =>
      [-1, 1].map((side) => (
        <mesh
          key={`seam-${x}-${side}`}
          position={[x, TRAILER_HEIGHT / 2, side * (TRAILER_WIDTH / 2 + 0.01)]}
          rotation={side < 0 ? [0, Math.PI, 0] : [0, 0, 0]}
        >
          <planeGeometry args={[0.06, TRAILER_HEIGHT - 0.2]} />
          <meshStandardMaterial {...SEAM_MATERIAL_PROPS} />
        </mesh>
      )),
    )}
  </group>
);

// A vertical triangular prism: wide at the back (matching the box body's
// cross-section), tapering to a point at the front — extruded straight up
// from the floor to the roofline, so the top/bottom edges stay flat.
const useNoseGeometry = () =>
  useMemo(() => {
    const halfWidth = TRAILER_WIDTH / 2;
    const topLeftBack: Vec3 = [NOSE_BASE_X, TRAILER_HEIGHT, -halfWidth];
    const topRightBack: Vec3 = [NOSE_BASE_X, TRAILER_HEIGHT, halfWidth];
    const bottomLeftBack: Vec3 = [NOSE_BASE_X, 0, -halfWidth];
    const bottomRightBack: Vec3 = [NOSE_BASE_X, 0, halfWidth];
    const topTip: Vec3 = [NOSE_TIP_X, TRAILER_HEIGHT, 0];
    const bottomTip: Vec3 = [NOSE_TIP_X, 0, 0];

    const vertices = new Float32Array(
      [
        // Top face
        topLeftBack, topTip, topRightBack,
        // Bottom face
        bottomLeftBack, bottomRightBack, bottomTip,
        // Left slanted face
        bottomLeftBack, topLeftBack, topTip,
        bottomLeftBack, topTip, bottomTip,
        // Right slanted face
        bottomRightBack, bottomTip, topTip,
        bottomRightBack, topTip, topRightBack,
      ].flat(),
    );

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, []);

const InteriorProps: React.FC = () => {
  return (
    <group>
      <mesh position={GENERATOR_POS}>
        <boxGeometry args={GENERATOR_SIZE} />
        <meshStandardMaterial color="#8a6a4a" roughness={0.9} metalness={0} flatShading />
      </mesh>

      <mesh position={TANK_POS}>
        <cylinderGeometry args={[TANK_RADIUS, TANK_RADIUS, TANK_HEIGHT, 20]} />
        <meshStandardMaterial color="#5c7a8a" roughness={0.9} metalness={0} flatShading />
      </mesh>

      <mesh position={UTILITY_A_POS}>
        <boxGeometry args={UTILITY_A_SIZE} />
        <meshStandardMaterial color="#6b7280" roughness={0.9} metalness={0} flatShading />
      </mesh>

      <mesh position={UTILITY_B_POS}>
        <boxGeometry args={UTILITY_B_SIZE} />
        <meshStandardMaterial color="#7a8a80" roughness={0.9} metalness={0} flatShading />
      </mesh>
    </group>
  );
};
