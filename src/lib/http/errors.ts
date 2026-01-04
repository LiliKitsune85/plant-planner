export class HttpError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(
    status: number,
    message: string,
    code = 'HTTP_ERROR',
    details?: unknown,
  ) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export const isHttpError = (error: unknown): error is HttpError =>
  error instanceof HttpError

export class InvalidCursorError extends HttpError {
  constructor(message = 'Invalid cursor') {
    super(400, message, 'INVALID_CURSOR')
  }
}
