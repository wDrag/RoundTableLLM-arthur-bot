export const maskAuthorization = (value?: string): string | undefined => {
  if (!value) return value;
  const trimmed = value.replace(/^Bearer\s+/i, "");
  if (trimmed.length <= 6) return "***";
  return `${trimmed.slice(0, 4)}***${trimmed.slice(-2)}`;
};

export const logRequest = (logger: { info: (obj: unknown) => void }, payload: unknown): void => {
  logger.info(payload);
};
