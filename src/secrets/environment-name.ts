const ENVIRONMENT_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function isValidEnvironmentName(value: string): boolean {
  return ENVIRONMENT_NAME.test(value);
}
