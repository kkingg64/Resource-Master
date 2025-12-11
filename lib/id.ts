// A simple alphanumeric ID generator.
// Not guaranteed to be globally unique like a UUID, but is shorter and more human-readable for this application's scope.
export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${timestamp}${randomPart}`;
}
