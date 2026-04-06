export interface AriaErrorOptions {
  code: string;
  hint?: string;
  cause?: unknown;
}

export class AriaError extends Error {
  code: string;
  hint?: string;
  cause?: unknown;

  constructor(message: string, options: AriaErrorOptions) {
    super(message);
    this.name = "AriaError";
    this.code = options.code;
    this.hint = options.hint;
    this.cause = options.cause;
  }
}

export class ValidationError extends AriaError {
  constructor(message: string, hint?: string) {
    super(message, { code: "validation_error", hint });
    this.name = "ValidationError";
  }
}

export class UnsupportedOperationError extends AriaError {
  constructor(message: string, hint?: string) {
    super(message, { code: "unsupported_operation", hint });
    this.name = "UnsupportedOperationError";
  }
}

export class AuthError extends AriaError {
  constructor(message: string, hint?: string) {
    super(message, { code: "auth_error", hint });
    this.name = "AuthError";
  }
}

export class ExternalServiceError extends AriaError {
  constructor(message: string, hint?: string, cause?: unknown) {
    super(message, { code: "external_service_error", hint, cause });
    this.name = "ExternalServiceError";
  }
}

export function isAriaError(error: unknown): error is AriaError {
  return error instanceof AriaError;
}
