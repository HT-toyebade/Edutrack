type Environment = Record<string, unknown>;

const REQUIRED_ENVIRONMENT_VARIABLES = [
  'DB_HOST',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_DATABASE',
  'JWT_SECRET',
] as const;

function validatePort(environment: Environment, name: 'DB_PORT' | 'PORT') {
  const value = environment[name];
  if (value === undefined || value === '') return;

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be an integer between 1 and 65535.`);
  }
}

export function validateEnvironment<T extends Environment>(environment: T): T {
  const missing = REQUIRED_ENVIRONMENT_VARIABLES.filter((name) => {
    const value = environment[name];
    return typeof value !== 'string' || value.trim().length === 0;
  });

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  validatePort(environment, 'DB_PORT');
  validatePort(environment, 'PORT');
  const smtpVariables = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'EMAIL_FROM'];
  if (smtpVariables.some((name) => typeof environment[name] === 'string' && String(environment[name]).trim() !== '')) {
    if (!environment.SMTP_HOST) throw new Error('SMTP_HOST is required when SMTP delivery is configured.');
    const smtpRequired = ['SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'EMAIL_FROM'];
    const missingSmtp = smtpRequired.filter((name) => typeof environment[name] !== 'string' || String(environment[name]).trim() === '');
    if (missingSmtp.length) throw new Error(`SMTP configuration is incomplete: ${missingSmtp.join(', ')}.`);
    const smtpPort = Number(environment.SMTP_PORT);
    if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) throw new Error('SMTP_PORT must be an integer between 1 and 65535.');
  }
  return environment;
}
