import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EnvironmentValidator } from '../../../../infrastructure/validation/EnvironmentValidator';
import { Environment } from '../../../../shared/types';

describe('EnvironmentValidator', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('allows testnet access in CI', () => {
    process.env.CI = 'true';
    const validator = new EnvironmentValidator();
    expect(() => validator.validate(Environment.TESTNET)).not.toThrow();
  });

  it('blocks mainnet access in CI by default', () => {
    process.env.CI = 'true';
    const validator = new EnvironmentValidator();
    expect(() => validator.validate(Environment.MAINNET)).toThrow(
      'Production (mainnet) access is blocked in CI environments'
    );
  });

  it('allows mainnet access in CI when explicitly opted in', () => {
    process.env.CI = 'true';
    const validator = new EnvironmentValidator({ allowProductionInCI: true });
    expect(() => validator.validate(Environment.MAINNET)).not.toThrow();
  });

  it('allows mainnet access outside CI', () => {
    delete process.env.CI;
    const validator = new EnvironmentValidator();
    expect(() => validator.validate(Environment.MAINNET)).not.toThrow();
  });

  it('detects CI=1 as CI environment', () => {
    process.env.CI = '1';
    const validator = new EnvironmentValidator();
    expect(() => validator.validate(Environment.MAINNET)).toThrow();
  });

  it('does not treat CI=false as CI environment', () => {
    process.env.CI = 'false';
    const validator = new EnvironmentValidator();
    expect(() => validator.validate(Environment.MAINNET)).not.toThrow();
  });
});
