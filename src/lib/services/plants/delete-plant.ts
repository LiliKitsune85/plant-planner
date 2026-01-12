import type { SupabaseClient } from "../../../db/supabase.client";
import type { DeletePlantResultDto } from "../../../types";
import { HttpError } from "../../http/errors";

export interface DeletePlantCommand {
  plantId: string;
  userId: string;
}

export const deletePlant = async (
  supabase: SupabaseClient,
  { plantId, userId }: DeletePlantCommand
): Promise<DeletePlantResultDto> => {
  const { data, error } = await supabase
    .from("plants")
    .delete()
    .eq("id", plantId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new HttpError(500, "Failed to delete plant", "PLANT_DELETE_FAILED");
  }

  if (!data) {
    throw new HttpError(404, "Plant not found", "PLANT_NOT_FOUND");
  }

  return {
    deleted: true,
    plant_id: data.id,
  };
};
