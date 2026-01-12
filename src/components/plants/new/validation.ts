import type { CreatePlantCommand } from "@/types";

import type { CreatePlantFormErrors, CreatePlantFormField, CreatePlantFormValues } from "./types";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const ensureArrayEntry = (
  target: Partial<Record<CreatePlantFormField, string[]>>,
  field: CreatePlantFormField,
  message: string
) => {
  const existing = target[field];
  target[field] = existing ? [...existing, message] : [message];
};

const isValidIsoDate = (value: string): boolean => {
  if (!ISO_DATE_REGEX.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
};

const normalizeOptionalString = (value: string): string => value.trim();

export const validateCreatePlant = (values: CreatePlantFormValues): CreatePlantFormErrors => {
  const fieldErrors: CreatePlantFormErrors["fieldErrors"] = {};

  const speciesName = values.species_name.trim();
  if (!speciesName) {
    ensureArrayEntry(fieldErrors, "species_name", "Nazwa gatunku jest wymagana.");
  } else if (speciesName.length > 120) {
    ensureArrayEntry(fieldErrors, "species_name", "Nazwa gatunku może mieć maks. 120 znaków.");
  }

  const nickname = values.nickname.trim();
  if (nickname && nickname.length > 80) {
    ensureArrayEntry(fieldErrors, "nickname", "Pseudonim może mieć maks. 80 znaków.");
  }

  const description = values.description.trim();
  if (description.length > 10_000) {
    ensureArrayEntry(fieldErrors, "description", "Opis może mieć maks. 10 000 znaków.");
  }

  const purchaseDate = values.purchase_date.trim();
  if (purchaseDate && !isValidIsoDate(purchaseDate)) {
    ensureArrayEntry(fieldErrors, "purchase_date", "Data musi być w formacie RRRR-MM-DD i być poprawną datą.");
  }

  return {
    fieldErrors,
  };
};

export const hasCreatePlantFieldErrors = (errors: CreatePlantFormErrors): boolean =>
  Object.values(errors.fieldErrors).some((messages) => (messages?.length ?? 0) > 0);

export const sanitizeCreatePlantValues = (values: CreatePlantFormValues): CreatePlantCommand => {
  const nickname = normalizeOptionalString(values.nickname);
  const description = normalizeOptionalString(values.description);
  const purchaseDate = normalizeOptionalString(values.purchase_date);

  return {
    species_name: values.species_name.trim(),
    nickname: nickname.length ? nickname : null,
    description: description.length ? description : null,
    purchase_date: purchaseDate.length ? purchaseDate : null,
    photo_path: null,
    generate_watering_suggestion: values.generate_watering_suggestion,
  };
};

interface IssueDetails {
  issues?: {
    message?: string;
    path?: (string | number)[];
  }[];
}

interface FieldDetails {
  field?: string;
  message?: string;
}

const mapIssuePathToField = (path: (string | number)[] | undefined): CreatePlantFormField => {
  if (!path || path.length === 0) return "form";
  const [first] = path;
  if (
    first === "species_name" ||
    first === "nickname" ||
    first === "description" ||
    first === "purchase_date" ||
    first === "generate_watering_suggestion"
  ) {
    return first;
  }
  return "form";
};

export const mergeFieldErrorsFromDetails = (existing: CreatePlantFormErrors["fieldErrors"], details: unknown) => {
  if (!details || typeof details !== "object") return existing;

  const normalized = { ...existing };

  if ("field" in details && typeof (details as FieldDetails).field === "string") {
    const fieldName = (details as FieldDetails).field;
    const messageValue = (details as FieldDetails).message;
    const message = typeof messageValue === "string" ? messageValue : "Nieprawidłowa wartość.";
    const field = mapIssuePathToField([fieldName]);
    ensureArrayEntry(normalized, field, message);
  }

  if ("issues" in details && Array.isArray((details as IssueDetails).issues)) {
    for (const issue of (details as IssueDetails).issues ?? []) {
      if (!issue) continue;
      const field = mapIssuePathToField(issue.path);
      ensureArrayEntry(
        normalized,
        field,
        issue.message ?? "Pole zawiera nieprawidłowe dane. Zweryfikuj i spróbuj ponownie."
      );
    }
  }

  return normalized;
};
