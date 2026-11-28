type ConfigClient = { rpc: (name: string) => PromiseLike<{ data: unknown; error: unknown }> };
type EnvironmentConfig = { sid: string; token: string; from: string };

/** Only the service client can resolve the existing, fixed SMS vault reference. */
export async function loadTwilioConfig(client: ConfigClient, env: EnvironmentConfig) {
  const { data, error } = await client.rpc('sms_effective_config');
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Geschützte SMS-Konfiguration nicht verfügbar');
  }
  const config = data as Record<string, unknown>;
  const text = (key: string) => typeof config[key] === 'string' ? config[key].trim() : '';
  const dbSid = text('account_sid'), dbToken = text('auth_token'), dbFrom = text('from_number');
  // Never combine a stored account with credentials from a different account.
  if (dbSid && !dbToken && dbSid !== env.sid) {
    throw new Error('SMS-Konto und Zugangstoken sind nicht eindeutig zugeordnet');
  }
  if (dbToken && !dbSid) throw new Error('Geschütztem SMS-Token fehlt die Kontozuordnung');
  return {
    sid: dbSid || env.sid, token: dbToken || env.token, from: dbFrom || env.from,
    db_sid: Boolean(dbSid), db_token: Boolean(dbToken), db_from: Boolean(dbFrom),
  };
}