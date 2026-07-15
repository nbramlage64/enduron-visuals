import "./index.css";
import { MyComposition } from "./Composition";
import { LowerThirdComposition } from "./LowerThird";
import { DualBarChartComposition } from "./DualBarChart";
import { TrailerFlythroughComposition } from "./TrailerFlythrough";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <LowerThirdComposition />
      <DualBarChartComposition />
      <TrailerFlythroughComposition />
    </>
  );
};
