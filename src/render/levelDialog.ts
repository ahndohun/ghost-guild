import type { LevelDialogState } from "../sim/types";

export type LevelDialogProjection = {
  readonly headline: string;
  readonly levelLabel: string;
  readonly reason: string;
  readonly flavor: string;
};

export function projectLevelDialog(dialog: LevelDialogState): LevelDialogProjection {
  return {
    headline: nonBlank(dialog.selectedOptionLabel) ?? "LEVEL UP",
    levelLabel: Number.isFinite(dialog.newLevel) ? `HERO LV.${dialog.newLevel}` : "",
    reason: nonBlank(dialog.reason) ?? "",
    flavor: dialog.text,
  };
}

export function drawLevelDialog(
  context: CanvasRenderingContext2D,
  dialogState: LevelDialogState,
): void {
  const dialog = projectLevelDialog(dialogState);
  context.fillStyle = "#05040a";
  context.fillRect(96, 430, 768, 76);
  context.strokeStyle = "#ffffff";
  context.lineWidth = 3;
  context.strokeRect(96, 430, 768, 76);
  context.strokeRect(103, 437, 754, 62);
  context.fillStyle = "#e8e3d5";
  context.font = "14px 'Press Start 2P', monospace";
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText(dialog.headline, 122, 451, 520);

  if (dialog.levelLabel.length > 0) {
    context.fillStyle = "#f0d476";
    context.font = "10px 'Press Start 2P', monospace";
    context.textAlign = "right";
    context.fillText(dialog.levelLabel, 838, 451, 180);
  }

  context.fillStyle = "#9fe3b0";
  context.font = "9px 'Press Start 2P', monospace";
  context.textAlign = "left";
  if (dialog.reason.length > 0) {
    context.fillText(dialog.reason, 122, 473, 716);
  }

  context.fillStyle = "#e8e3d5";
  context.fillText(dialog.flavor, 122, 492, 716);
}

function nonBlank(value: string | undefined): string | undefined {
  return value !== undefined && value.trim().length > 0 ? value : undefined;
}
