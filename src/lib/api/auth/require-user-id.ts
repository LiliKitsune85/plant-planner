import { HttpError } from "../../http/errors";

const getBearerToken = (request: Request): string | null => {
  const header = request.headers.get("authorization");
  if (!header) return null;

  const match = /^Bearer\s+(.+)$/.exec(header);
  return match?.[1] ?? null;
};

export const requireUserId = async (locals: App.Locals, request: Request): Promise<string> => {
  const token = getBearerToken(request);
  const { data, error } = token ? await locals.supabase.auth.getUser(token) : await locals.supabase.auth.getUser();

  if (error || !data.user) {
    throw new HttpError(401, "Unauthenticated", "UNAUTHENTICATED");
  }

  return data.user.id;
};
