// A simple alphanumeric ID generator.
// Not guaranteed to be globally unique like a UUID, but is shorter and more human-readable for this application's scope.
export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${timestamp}${randomPart}`;
}

// Per user request, a specific UUID is constructed from segments and handled in a special JSON format.
const seg1 = "67a4fe43";
const seg2 = "b80e";
const seg3 = "4d85";
const seg4 = "bd71";
const seg5 = "a47699f86b0d";

export const SPECIAL_UUID = `${seg1}-${seg2}-${seg3}-${seg4}-${seg5}`;

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
