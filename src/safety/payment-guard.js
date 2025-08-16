class PaymentGuard {
  constructor(logger) {
    this.logger = logger;
    this.paymentKeywords = [
      'credit card', 'payment', 'checkout', 'billing', 'purchase',
      'visa', 'mastercard', 'amex', 'paypal', 'stripe', 'square',
      'cvv', 'security code', 'expiry', 'expiration', 'card number'
    ];
    
    this.paymentSelectors = [
      'input[type="number"][name*="card"]',
      'input[name*="credit"]',
      'input[name*="payment"]',
      'input[placeholder*="card"]',
      'input[placeholder*="payment"]',
      'input[id*="card"]',
      'input[id*="payment"]',
      '.payment-form',
      '.credit-card',
      '[class*="payment"]',
      '[class*="checkout"]',
      'stripe-card',
      'iframe[src*="stripe"]',
      'iframe[src*="paypal"]'
    ];
    
    this.violations = [];
  }

  validateEventCost(event) {
    if (typeof event.cost !== 'number' || event.cost < 0) {
      this.logViolation('INVALID_COST', `Event has invalid cost: ${event.cost}`, event);
      return false;
    }
    
    if (event.cost > 0) {
      this.logger.warn(`PAYMENT GUARD: Event requires payment: ${event.title} - $${event.cost}`);
      return { requiresPayment: true, amount: event.cost };
    }
    
    return { requiresPayment: false };
  }

  async validateRegistrationPage(page, event) {
    const violations = [];
    
    try {
      const pageContent = await page.content();
      const bodyText = await page.evaluate(() => document.body.textContent.toLowerCase());
      
      for (const keyword of this.paymentKeywords) {
        if (bodyText.includes(keyword)) {
          violations.push({
            type: 'PAYMENT_KEYWORD',
            keyword,
            message: `Payment-related keyword detected: ${keyword}`
          });
        }
      }
      
      for (const selector of this.paymentSelectors) {
        try {
          const elements = await page.$$(selector);
          if (elements.length > 0) {
            violations.push({
              type: 'PAYMENT_FIELD',
              selector,
              count: elements.length,
              message: `Payment form field detected: ${selector}`
            });
          }
        } catch (error) {
          // Continue checking other selectors
        }
      }
      
      const priceElements = await this.detectPricing(page);
      if (priceElements.length > 0) {
        for (const priceElement of priceElements) {
          if (priceElement.amount > 0) {
            violations.push({
              type: 'PRICE_DETECTED',
              amount: priceElement.amount,
              text: priceElement.text,
              message: `Price detected on supposedly free event: $${priceElement.amount}`
            });
          }
        }
      }
      
      if (violations.length > 0) {
        this.logViolation('PAYMENT_PAGE_DETECTED', 
          `Payment elements detected on registration page for event: ${event.title}`, 
          event, 
          violations
        );
        return { safe: false, violations };
      }
      
      return { safe: true, violations: [] };
      
    } catch (error) {
      this.logger.error('Error validating registration page:', error.message);
      return { safe: false, violations: [{ type: 'VALIDATION_ERROR', message: error.message }] };
    }
  }

  async detectPricing(page) {
    const priceElements = [];
    
    const priceSelectors = [
      '.price', '.cost', '.amount', '.total', '.fee',
      '[class*="price"]', '[class*="cost"]', '[class*="amount"]',
      '[class*="total"]', '[class*="fee"]'
    ];
    
    for (const selector of priceSelectors) {
      try {
        const elements = await page.$$(selector);
        for (const element of elements) {
          const text = await page.evaluate(el => el.textContent, element);
          const priceMatch = text.match(/\$(\d+(?:\.\d{2})?)/);
          if (priceMatch) {
            priceElements.push({
              amount: parseFloat(priceMatch[1]),
              text: text.trim(),
              selector
            });
          }
        }
      } catch (error) {
        // Continue with other selectors
      }
    }
    
    return priceElements;
  }

  preventAutomationOnPaidEvent(event) {
    if (event.cost > 0) {
      const error = new Error(`SAFETY VIOLATION: Attempted automation on paid event: ${event.title} ($${event.cost})`);
      this.logViolation('PAID_EVENT_AUTOMATION', error.message, event);
      throw error;
    }
  }

  validateFormData(formData) {
    const sensitiveFields = ['card', 'credit', 'payment', 'cvv', 'ssn', 'account'];
    
    for (const [key, value] of Object.entries(formData)) {
      const lowerKey = key.toLowerCase();
      
      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        this.logViolation('SENSITIVE_FORM_DATA', 
          `Attempted to fill sensitive form field: ${key}`, 
          null, 
          { field: key, value: typeof value }
        );
        throw new Error(`SAFETY VIOLATION: Refusing to fill sensitive field: ${key}`);
      }
    }
  }

  logViolation(type, message, event = null, details = null) {
    const violation = {
      type,
      message,
      timestamp: new Date().toISOString(),
      event: event ? { id: event.id, title: event.title, cost: event.cost } : null,
      details
    };
    
    this.violations.push(violation);
    this.logger.error(`PAYMENT GUARD VIOLATION [${type}]: ${message}`, details);
    
    if (this.violations.length > 100) {
      this.violations = this.violations.slice(-50);
    }
  }

  getViolationSummary() {
    return {
      total: this.violations.length,
      byType: this.violations.reduce((acc, v) => {
        acc[v.type] = (acc[v.type] || 0) + 1;
        return acc;
      }, {}),
      recent: this.violations.slice(-10)
    };
  }

  clearViolations() {
    const count = this.violations.length;
    this.violations = [];
    this.logger.info(`Cleared ${count} payment guard violations`);
    return count;
  }
}

module.exports = PaymentGuard;