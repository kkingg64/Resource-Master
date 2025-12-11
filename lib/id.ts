// A simple alphanumeric ID generator.
// Not guaranteed to be globally unique like a UUID, but is shorter and more human-readable for this application's scope.
export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${timestamp}${randomPart}`;
}

// Per user request, a specific UUID to be handled in a special JSON format.
export const SPECIAL_UUID = '67a4fe43-b80e-4d85-bd71-a47699f86b0d';

/**
 * Formats a given ID for display purposes.
 * If the ID matches the special UUID, it returns it in a structured JSON format.
 * Otherwise, it returns the ID as is.
 * @param id The ID to format.
 * @returns The formatted ID string.
 */
export function formatIdForDisplay(id: string): string {
  if (id === SPECIAL_UUID) {
    return JSON.stringify({ "uuid": SPECIAL_UUID }, null, 2);
  }
  return id;
}
