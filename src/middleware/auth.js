const authenticateAPI = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key required'
    });
  }
  
  // Normalize API keys by removing backslashes (frontend may escape $ characters)
  const normalizedApiKey = apiKey.replace(/\\/g, '');
  const normalizedExpectedKey = process.env.API_KEY.replace(/\\/g, '');
  
  if (normalizedApiKey !== normalizedExpectedKey) {
    return res.status(403).json({
      success: false,
      error: 'Invalid API key'
    });
  }
  
  next();
};

module.exports = { authenticateAPI };