import { emptyDeskState } from "@/lib/desk/defaults";
import type { DairyState } from "@/lib/types";

export function createSeedState(): DairyState {
  return emptyDeskState();
}
