import { describe, expect, it } from "vitest";
import {
  ACTIVITIES,
  createDemoStates,
  getPose,
  describeActivity,
  isPetState,
  parsePetState,
} from "../../desktop/src/pet-state";

describe("desktop pet semantic state", () => {
  it("prioritizes approval and connection status over the last activity", () => {
    const state = { sessionId: "test", sequence: 1, timestamp: 1000, activity: "thinking" as const, status: "running" as const };
    expect(describeActivity(state)).toBe("thinking");
    expect(describeActivity({ ...state, status: "needs-input" })).toBe("needs your approval");
    expect(describeActivity({ ...state, status: "ready" })).toBe("ready for your next task");
    expect(describeActivity({ ...state, status: "disconnected" })).toBe("reconnecting");
    expect(describeActivity({ ...state, status: "ended" })).toBe("session ended");
  });
  it("declares one valid local frame set for every activity", () => {
    for (const activity of ACTIVITIES) {
      const pose = getPose(activity);
      expect(pose.frames.length).toBeGreaterThan(0);
      expect(pose.frames.every((path) => path.startsWith("./assets/default/"))).toBe(
        true,
      );
      expect(pose.intervalMs).toBeGreaterThan(0);
    }
  });

  it("creates a complete deterministic demo sequence", () => {
    const states = createDemoStates(1000);
    expect(states.map((state) => state.activity)).toEqual(ACTIVITIES);
    expect(states.map((state) => state.sequence)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    expect(states.every(isPetState)).toBe(true);
  });

  it("rejects malformed or privacy-leaking lookalike updates", () => {
    expect(
      isPetState({
        sessionId: "s",
        sequence: 1,
        status: "pretending-to-work",
        activity: "thinking",
        timestamp: 1000,
        prompt: "private text",
      }),
    ).toBe(false);
    expect(() => parsePetState({ activity: "reading" })).toThrow(
      "Invalid Claude Pet session-state update",
    );
  });
});
