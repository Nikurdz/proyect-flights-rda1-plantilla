import { dbSsl } from './db-ssl';

describe('dbSsl', () => {
  it('verifies against the provided CA', () => {
    expect(dbSsl({ DB_SSL_CA: 'PEM' })).toEqual({ ca: 'PEM', rejectUnauthorized: true });
  });

  it('accepts a PEM kept on one line with literal \\n', () => {
    expect(dbSsl({ DB_SSL_CA: '-----BEGIN CERTIFICATE-----\\nABC\\n-----END CERTIFICATE-----' })?.ca).toBe('-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----');
  });

  it('overrides nothing without a CA: the driver decides', () => {
    expect(dbSsl({})).toBeUndefined();
    expect(dbSsl({ DATABASE_URL: 'postgres://u:p@db-x.l.aivencloud.com:26899/defaultdb?sslmode=require' })).toBeUndefined();
  });
});
