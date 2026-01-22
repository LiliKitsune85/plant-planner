import { describe, expect, it } from "vitest";

import { HttpError } from "@/lib/http/errors";
import { parseCreatePlantRequest } from "@/lib/api/plants/create-plant-request";

describe("parseCreatePlantRequest", () => {
  it("returns 422 with issues for invalid payload", () => {
    try {
      parseCreatePlantRequest({ species_name: "" });
      throw new Error("Expected parser to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      const err = error as HttpError;
      expect(err.status).toBe(422);
      expect(err.code).toBe("VALIDATION_ERROR");
      const issues = (err.details as { issues?: { path?: string }[] }).issues;
      expect(Array.isArray(issues)).toBe(true);
      expect(issues?.[0]?.path).toBe("species_name");
    }
  });
});
