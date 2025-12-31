-- Migration: Create Money Pillar Tables
-- Introduces Accounts, Transactions, Budgets, and FIRE planning

-- 1. Financial Accounts Table
CREATE TABLE IF NOT EXISTS financial_accounts (
    id SERIAL PRIMARY KEY,
    household_id INTEGER REFERENCES households(id) ON DELETE CASCADE,
    owner_profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    institution VARCHAR(255),
    account_type VARCHAR(50) NOT NULL, -- e.g. "checking", "savings", "investment", "debt", "real_estate"
    
    balance DECIMAL(15, 2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'USD',
    
    is_asset BOOLEAN DEFAULT true, -- assets vs liabilities
    is_active BOOLEAN DEFAULT true,
    
    last_synced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Transactions Table (Manual/CSV Import)
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES financial_accounts(id) ON DELETE CASCADE,
    household_id INTEGER REFERENCES households(id) ON DELETE CASCADE,
    
    transaction_date DATE NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    
    category VARCHAR(100), -- e.g. "food", "rent", "salary"
    tags TEXT[],
    
    is_pending BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Budgets Table
CREATE TABLE IF NOT EXISTS budgets (
    id SERIAL PRIMARY KEY,
    household_id INTEGER REFERENCES households(id) ON DELETE CASCADE,
    
    category VARCHAR(100) NOT NULL,
    target_amount DECIMAL(15, 2) NOT NULL,
    period VARCHAR(20) DEFAULT 'monthly', -- monthly, yearly
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(household_id, category, period)
);

-- 4. FIRE Planning / Snapshots
CREATE TABLE IF NOT EXISTS net_worth_snapshots (
    id SERIAL PRIMARY KEY,
    household_id INTEGER REFERENCES households(id) ON DELETE CASCADE,
    
    snapshot_date DATE NOT NULL,
    total_assets DECIMAL(15, 2) NOT NULL,
    total_liabilities DECIMAL(15, 2) NOT NULL,
    net_worth DECIMAL(15, 2) NOT NULL,
    
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(household_id, snapshot_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_accounts_household ON financial_accounts(household_id);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trigger_financial_accounts_updated_at ON financial_accounts;
CREATE TRIGGER trigger_financial_accounts_updated_at BEFORE UPDATE ON financial_accounts FOR EACH ROW EXECUTE FUNCTION update_foundation_updated_at();

DROP TRIGGER IF EXISTS trigger_transactions_updated_at ON transactions;
CREATE TRIGGER trigger_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_foundation_updated_at();

DROP TRIGGER IF EXISTS trigger_budgets_updated_at ON budgets;
CREATE TRIGGER trigger_budgets_updated_at BEFORE UPDATE ON budgets FOR EACH ROW EXECUTE FUNCTION update_foundation_updated_at();
