import { ValidationError } from "./errors";

interface IntegerOptions {
  min?: number;
  max?: number;
}

export function parseInteger(name: string, value: string, options: IntegerOptions = {}): number {
  if (!/^-?\d+$/.test(value)) {
    throw new ValidationError(`${name} must be an integer`);
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed)) {
    throw new ValidationError(`${name} must be a safe integer`);
  }
  if (options.min !== undefined && parsed < options.min) {
    throw new ValidationError(`${name} must be at least ${options.min}`);
  }
  if (options.max !== undefined && parsed > options.max) {
    throw new ValidationError(`${name} must be at most ${options.max}`);
  }

  return parsed;
}
