import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalStoragePortfolioRepository } from '../../../../infrastructure/repositories/LocalStoragePortfolioRepository';
import { PortfolioAggregate } from '../../../../domain/aggregates/Portfolio';
import { Environment } from '../../../../shared/types';

// Mock localStorage
const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => mockStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value; }),
  removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
  clear: vi.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }),
  length: 0,
  key: vi.fn(() => null),
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });

function makePortfolio(id: string): PortfolioAggregate {
  return new PortfolioAggregate({
    id,
    assets: [],
    sources: [],
    lastUpdated: new Date('2026-01-01'),
  });
}

describe('LocalStoragePortfolioRepository cache isolation', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    vi.clearAllMocks();
  });

  it('uses environment-prefixed storage key for testnet', async () => {
    const repo = new LocalStoragePortfolioRepository(Environment.TESTNET);
    const portfolio = makePortfolio('p1');
    await repo.save(portfolio);

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'cygnus_portfolios_testnet',
      expect.any(String)
    );
  });

  it('uses environment-prefixed storage key for mainnet', async () => {
    const repo = new LocalStoragePortfolioRepository(Environment.MAINNET);
    const portfolio = makePortfolio('p2');
    await repo.save(portfolio);

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'cygnus_portfolios_mainnet',
      expect.any(String)
    );
  });

  it('defaults to mainnet when no environment specified', async () => {
    const repo = new LocalStoragePortfolioRepository();
    const portfolio = makePortfolio('p3');
    await repo.save(portfolio);

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'cygnus_portfolios_mainnet',
      expect.any(String)
    );
  });

  it('isolates data between environments', async () => {
    const testnetRepo = new LocalStoragePortfolioRepository(Environment.TESTNET);
    const mainnetRepo = new LocalStoragePortfolioRepository(Environment.MAINNET);

    await testnetRepo.save(makePortfolio('testnet-p1'));
    await mainnetRepo.save(makePortfolio('mainnet-p1'));

    const testnetResult = await testnetRepo.findById('testnet-p1');
    const mainnetResult = await mainnetRepo.findById('mainnet-p1');
    const crossResult = await testnetRepo.findById('mainnet-p1');

    expect(testnetResult).not.toBeNull();
    expect(mainnetResult).not.toBeNull();
    expect(crossResult).toBeNull();
  });
});
