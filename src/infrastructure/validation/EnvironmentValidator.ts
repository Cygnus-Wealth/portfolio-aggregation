import { Environment } from '../../shared/types';

export interface EnvironmentValidatorConfig {
  allowProductionInCI?: boolean;
}

export class EnvironmentValidator {
  private readonly allowProductionInCI: boolean;

  constructor(config: EnvironmentValidatorConfig = {}) {
    this.allowProductionInCI = config.allowProductionInCI ?? false;
  }

  validate(environment: Environment): void {
    if (this.isCI() && environment === Environment.MAINNET && !this.allowProductionInCI) {
      throw new Error(
        'Production (mainnet) access is blocked in CI environments. ' +
        'Set allowProductionInCI: true to explicitly opt in.'
      );
    }
  }

  isCI(): boolean {
    return typeof process !== 'undefined' &&
      (process.env?.CI === 'true' || process.env?.CI === '1');
  }
}
