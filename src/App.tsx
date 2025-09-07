import { useState, useEffect } from 'react'
import './App.css'
import { PortfolioAggregate } from './domain/aggregates/Portfolio'
import { AssetEntity } from './domain/entities/Asset'
import { AssetType, Chain } from './shared/types'

function App() {
  const [portfolio, setPortfolio] = useState<PortfolioAggregate | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Initialize with demo data
    const demoPortfolio = new PortfolioAggregate({
      id: 'demo-portfolio',
      userId: 'demo-user'
    })

    // Add some demo assets
    const btc = new AssetEntity({
      id: 'btc-1',
      symbol: 'BTC',
      name: 'Bitcoin',
      type: AssetType.CRYPTO,
      chain: Chain.ETHEREUM,
      balance: {
        amount: 0.5,
        decimals: 8,
        formatted: '0.50000000'
      },
      price: {
        value: 45000,
        currency: 'USD',
        timestamp: new Date()
      }
    })

    const eth = new AssetEntity({
      id: 'eth-1',
      symbol: 'ETH',
      name: 'Ethereum',
      type: AssetType.CRYPTO,
      chain: Chain.ETHEREUM,
      balance: {
        amount: 10,
        decimals: 18,
        formatted: '10.000000000000000000'
      },
      price: {
        value: 2500,
        currency: 'USD',
        timestamp: new Date()
      }
    })

    demoPortfolio.addAsset(btc)
    demoPortfolio.addAsset(eth)
    
    setPortfolio(demoPortfolio)
  }, [])

  const refreshPortfolio = async () => {
    setLoading(true)
    // Simulate refresh
    await new Promise(resolve => setTimeout(resolve, 1000))
    setLoading(false)
  }

  return (
    <div className="app">
      <header>
        <h1>CygnusWealth Portfolio Aggregation</h1>
        <p>Domain-Driven Design Portfolio Management</p>
      </header>

      <main>
        {portfolio && (
          <div className="portfolio-view">
            <div className="portfolio-header">
              <h2>Portfolio Overview</h2>
              <button onClick={refreshPortfolio} disabled={loading}>
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            <div className="portfolio-stats">
              <div className="stat-card">
                <h3>Total Value</h3>
                <p className="value">
                  ${portfolio.getTotalValue('USD').amount.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </p>
              </div>
              <div className="stat-card">
                <h3>Assets</h3>
                <p className="value">{portfolio.assets.length}</p>
              </div>
              <div className="stat-card">
                <h3>Last Updated</h3>
                <p className="value">{portfolio.lastUpdated.toLocaleTimeString()}</p>
              </div>
            </div>

            <div className="assets-list">
              <h3>Assets</h3>
              <table>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Name</th>
                    <th>Balance</th>
                    <th>Price</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.assets.map(asset => (
                    <tr key={asset.id}>
                      <td>{asset.symbol}</td>
                      <td>{asset.name || '-'}</td>
                      <td>{asset.balance.formatted}</td>
                      <td>${asset.price?.value.toLocaleString() || '-'}</td>
                      <td>
                        ${asset.getValue()?.amount.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        }) || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
