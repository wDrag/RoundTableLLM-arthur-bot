export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export class ProviderDisabledError extends Error {
  constructor(provider: string) {
    super(`${provider} provider is disabled in llm.config.json`);
    this.name = "ProviderDisabledError";
  }
}

export class ProviderConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderConfigError";
  }
}
