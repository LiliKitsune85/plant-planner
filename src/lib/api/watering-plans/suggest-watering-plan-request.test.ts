import { describe, expect, it } from "vitest";

import { HttpError } from "@/lib/http/errors";
import {
  parseSuggestWateringPlanParams,
  parseSuggestWateringPlanRequest,
} from "@/lib/api/watering-plans/suggest-watering-plan-request";

describe("parseSuggestWateringPlanRequest", () => {
  it("returns 422 with issues for invalid payload", () => {
    const tooLongName = "a".repeat(121);
    try {
      parseSuggestWateringPlanRequest({ context: { species_name: tooLongName } });
      throw new Error("Expected parser to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      const err = error as HttpError;
      expect(err.status).toBe(422);
      expect(err.code).toBe("VALIDATION_ERROR");
      const issues = (err.details as { issues?: { path?: string }[] }).issues;
      expect(Array.isArray(issues)).toBe(true);
      expect(issues?.[0]?.path).toBe("context.species_name");
    }
  });
});

describe("parseSuggestWateringPlanParams", () => {
  it("returns 422 with issues for invalid plantId", () => {
    try {
      parseSuggestWateringPlanParams({ plantId: "not-a-uuid" });
      throw new Error("Expected parser to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      const err = error as HttpError;
      expect(err.status).toBe(422);
      expect(err.code).toBe("VALIDATION_ERROR");
      const issues = (err.details as { issues?: { path?: string }[] }).issues;
      expect(Array.isArray(issues)).toBe(true);
      expect(issues?.[0]?.path).toBe("plantId");
    }
  });
});
