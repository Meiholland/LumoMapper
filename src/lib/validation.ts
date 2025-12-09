/**
 * Validation utilities for security
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates if a string is a valid UUID format
 */
export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Validates and returns error if UUID is invalid
 */
export function validateUUID(value: string, fieldName: string = "identifier"): { error?: string } {
  if (!value || typeof value !== 'string') {
    return { error: `Invalid ${fieldName} format` };
  }
  if (!isValidUUID(value)) {
    return { error: `Invalid ${fieldName} format` };
  }
  return {};
}

/**
 * Validates if a string is a valid email format
 */
export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value);
}

/**
 * Validates and returns error if email is invalid
 */
export function validateEmail(value: string): { error?: string } {
  if (!value || typeof value !== 'string') {
    return { error: "Invalid email format" };
  }
  if (!isValidEmail(value)) {
    return { error: "Invalid email format" };
  }
  return {};
}
