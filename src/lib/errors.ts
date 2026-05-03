export interface CiderErrorOptions {
  code: string;
  hint?: string;
  cause?: unknown;
}

export class CiderError extends Error {
  code: string;
  hint?: string;
  cause?: unknown;

  constructor(message: string, options: CiderErrorOptions) {
    super(message);
    this.name = "CiderError";
    this.code = options.code;
    this.hint = options.hint;
    this.cause = options.cause;
  }
}

export class ValidationError extends CiderError {
  constructor(message: string, hint?: string) {
    super(message, { code: "validation_error", hint });
    this.name = "ValidationError";
  }
}

export class UnsupportedOperationError extends CiderError {
  constructor(message: string, hint?: string) {
    super(message, { code: "unsupported_operation", hint });
    this.name = "UnsupportedOperationError";
  }
}

export class AuthError extends CiderError {
  constructor(message: string, hint?: string) {
    super(message, { code: "auth_error", hint });
    this.name = "AuthError";
  }
}

export class ExternalServiceError extends CiderError {
  constructor(message: string, hint?: string, cause?: unknown) {
    super(message, { code: "external_service_error", hint, cause });
    this.name = "ExternalServiceError";
  }
}

export function isCiderError(error: unknown): error is CiderError {
  return error instanceof CiderError;
}
