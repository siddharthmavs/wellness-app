import React from "react";

import WaterCard from "./WaterCard";
import EyeBreakCard from "./EyeBreakCard";
import MoveResetCard from "./MoveResetCard";
import BreathingCard from "./BreathingCard";

import "./ActionCards.css";

export default function ActionCards({
  onAction,
  onWaterReward,
}) {
  return (
    <div className="action-cards-grid">

      {/* Water */}
      <WaterCard
        onWaterReward={onWaterReward}
      />

      {/* Eye Break */}
      <EyeBreakCard
        onAction={onAction}
      />

      {/* Move / Reset */}
     <MoveResetCard 
        onAction={onAction}
     />

      {/* Breathing */}
      <BreathingCard
        onAction={onAction}
      />

    </div>
  );
}