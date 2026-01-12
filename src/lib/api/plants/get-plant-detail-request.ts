import type { User } from "@supabase/supabase-js";
import { z } from "zod";

import { HttpError } from "../../http/errors";

const plantIdParamSchema = z.object({
  plantId: z.string().uuid(),
});

export type PlantIdParams = z.infer<typeof plantIdParamSchema>;

export const parsePlantIdParams = (params: Record<string, string | undefined>): PlantIdParams => {
  const parsed = plantIdParamSchema.safeParse({ plantId: params.plantId });
  if (!parsed.success) {
    throw new HttpError(400, "Invalid plantId", "INVALID_PLANT_ID");
  }

  return parsed.data;
};

export const requireAuthUser = async (locals: App.Locals): Promise<User> => {
  const { data, error } = await locals.supabase.auth.getUser();
  if (error || !data.user) {
    throw new HttpError(401, "Unauthorized", "UNAUTHORIZED");
  }

  return data.user;
};
