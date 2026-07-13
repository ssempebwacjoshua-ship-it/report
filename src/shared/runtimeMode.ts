export function isDemoRuntime(): boolean {
  return import.meta.env.MODE === "development" || import.meta.env.MODE === "test";
}
