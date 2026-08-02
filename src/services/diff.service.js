import { diffLines } from "diff";

/**
 * Computes a line-level diff between two text snapshots and a short summary
 * of how many lines were added/removed, similar to Visualping's change report.
 */
export function computeDiff(previousText, currentText) {
  const parts = diffLines(previousText ?? "", currentText ?? "");

  let added = 0;
  let removed = 0;
  for (const part of parts) {
    const lineCount = part.count ?? 0;
    if (part.added) added += lineCount;
    else if (part.removed) removed += lineCount;
  }

  return {
    parts,
    summary: { linesAdded: added, linesRemoved: removed },
    changed: added > 0 || removed > 0,
  };
}

export default { computeDiff };
