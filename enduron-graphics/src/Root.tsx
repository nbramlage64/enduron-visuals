import "./index.css";
import { MyComposition } from "./Composition";
import { LowerThirdComposition } from "./LowerThird";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <LowerThirdComposition />
    </>
  );
};
