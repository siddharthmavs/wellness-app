import Phaser from "phaser";
import { TILE } from "../config/constants";
import { TrapAction, TrapEvent } from "../levels/types";
import { BuiltLevel, LevelBuilder } from "./LevelBuilder";

interface ArmedTrigger {
  rect: Phaser.Geom.Rectangle;
  actions: TrapAction[];
  fired: boolean;
}

export interface TrapHooks {
  flipGravity: () => void;
  shake: (intensity: number) => void;
  onSpikesEmerged: () => void;
  onTilesRemoved: () => void;
}

/**
 * Scripted "the level fights back" moments. Triggers are plain AABB checks
 * against the player each frame (a handful per level at most); actions
 * delegate to the LevelBuilder and scene hooks.
 */
export class TrapSystem {
  private triggers: ArmedTrigger[];
  private builder: LevelBuilder;
  private built: BuiltLevel;
  private hooks: TrapHooks;

  constructor(
    events: TrapEvent[] | undefined,
    builder: LevelBuilder,
    built: BuiltLevel,
    hooks: TrapHooks
  ) {
    this.builder = builder;
    this.built = built;
    this.hooks = hooks;
    this.triggers = (events ?? []).map((ev) => ({
      rect: new Phaser.Geom.Rectangle(
        ev.trigger.x * TILE,
        ev.trigger.y * TILE,
        ev.trigger.w * TILE,
        ev.trigger.h * TILE
      ),
      actions: ev.actions,
      fired: false,
    }));
  }

  update(playerRect: Phaser.Geom.Rectangle): void {
    for (const trigger of this.triggers) {
      if (trigger.fired) continue;
      if (!Phaser.Geom.Rectangle.Overlaps(trigger.rect, playerRect)) continue;
      trigger.fired = true;
      trigger.actions.forEach((action) => this.execute(action));
    }
  }

  private execute(action: TrapAction): void {
    switch (action.kind) {
      case "emergeSpikes":
        action.at.forEach((t) => {
          const spike = this.builder.makeEmergingSpike(t.x, t.y, action.dir ?? "up");
          this.built.hiddenSpikes.push(spike);
          this.builder.emerge(spike);
        });
        this.hooks.onSpikesEmerged();
        break;
      case "removeTiles":
        this.builder.removeTiles(action.at, this.built);
        this.hooks.onTilesRemoved();
        break;
      case "raiseWall":
        this.builder.raiseWall(action.at, this.built);
        this.hooks.onTilesRemoved();
        break;
      case "flipGravity":
        this.hooks.flipGravity();
        break;
      case "shake":
        this.hooks.shake(action.intensity ?? 0.004);
        break;
    }
  }
}
