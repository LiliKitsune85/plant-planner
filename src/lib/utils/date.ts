import { HttpError } from "../http/errors";

const ISO_DATE_LENGTH = 10;

const formatIsoDate = (date: Date): string => {
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(500, "Invalid date value", "DATE_FORMAT_ERROR");
  }

  return date.toISOString().slice(0, ISO_DATE_LENGTH);
};

export const monthToDateRange = (month: string): { rangeStart: string; rangeEnd: string } => {
  const [yearPart, monthPart] = month.split("-");
  const year = Number.parseInt(yearPart, 10);
  const monthIndex = Number.parseInt(monthPart, 10) - 1;

  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
    throw new HttpError(500, "Invalid month value", "CALENDAR_MONTH_RANGE_ERROR");
  }

  if (monthIndex < 0 || monthIndex > 11) {
    throw new HttpError(500, "Month value out of range", "CALENDAR_MONTH_RANGE_ERROR");
  }

  const rangeStartDate = new Date(Date.UTC(year, monthIndex, 1));
  const rangeEndDate = new Date(Date.UTC(year, monthIndex + 1, 1));

  if (Number.isNaN(rangeStartDate.getTime()) || Number.isNaN(rangeEndDate.getTime())) {
    throw new HttpError(500, "Failed to compute month range", "CALENDAR_MONTH_RANGE_ERROR");
  }

  return {
    rangeStart: formatIsoDate(rangeStartDate),
    rangeEnd: formatIsoDate(rangeEndDate),
  };
};
