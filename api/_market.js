const MarketEngine = require('../services/MarketEngine');
const Report = require('../models/Report'); 
const ShineConfig = require('../models/ShineConfig');

// Helper to normalize path
const getRoute = (req) => {
    // If query action exists, use that (Legacy priority)
    if (req.query.action) return req.query.action;
    
    // Clean path (req.path is relative if mounted with router.use)
    // But Vercel might pass full path?
    // In Express with router.use('/market', ...), req.path is '/balance'
    let path = req.path;
    if (path.startsWith('/')) path = path.slice(1);
    if (path === '') return 'root';
    return path;
};

const handler = async (req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-id');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Auth handled by middleware in index.js
        const user = req.user; 
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const route = getRoute(req);
        // console.log(`Market API: ${req.method} ${route}`);

        // --- GET Requests ---
        if (req.method === 'GET') {
            if (route === 'config') {
                const config = await ShineConfig.findOne();
                const economy = config?.economy || {};
                return res.json({ 
                    success: true, 
                    config: {
                        costCreate: economy.costCreate ?? 50,
                        costVerify: economy.costVerify ?? 2,
                        riskDeposit: economy.riskDeposit ?? 100,
                        energyCap: economy.energyCap ?? 100,
                        spatialRent: economy.spatialRent ?? 10,
                        dailyFreePings: economy.dailyFreePings ?? 5
                    }
                });
            }
            
            if (route === 'sparks' || route === 'my_sparks') {
                const sparks = await MarketEngine.getMySparks(user);
                return res.json({ success: true, sparks });
            }

            if (route === 'portfolio' || route === 'my_portfolio') {
                const portfolio = await MarketEngine.getMyPortfolio(user._id);
                return res.json({ success: true, portfolio });
            }

            if (route === 'balance') {
                 // Check daily stats
                 const stats = user.marketStats || {};
                 return res.json({
                     success: true,
                     energy: user.energy,
                     reputation: user.reputation,
                     pingsToday: stats.pingsToday || 0,
                     lastDailyReset: stats.lastDailyReset
                 });
            }
        }

        // --- POST Requests ---
        if (req.method === 'POST') {
            if (route === 'ping') {
                const { location, isRemote } = req.body;
                // Location can be {lat,lng} or H3 Index String
                const result = await MarketEngine.ping(user, location, 500, isRemote);
                return res.json({ success: true, ...result });
            }

            if (route === 'sparks' || route === 'create') {
                const { spark, energy } = await MarketEngine.createSpark(user, req.body);
                return res.status(201).json({ success: true, spark, energy });
            }

            if (route === 'verify') {
                const { sparkId, vote, meta } = req.body;
                // meta should include userLocation, distance
                const result = await MarketEngine.verify(user, sparkId, vote, meta);
                return res.json(result);
            }

            if (route === 'harvest') {
                const { sparkId } = req.body;
                const result = await MarketEngine.harvestDividends(user._id, sparkId);
                return res.json({ success: true, ...result });
            }
            
            if (route === 'report') {
                const { targetId, targetType, reason, description } = req.body;
                const report = new Report({
                  targetId,
                  targetType,
                  reporterId: user._id,
                  reason,
                  description
                });
                await report.save();
                return res.json({ success: true, message: 'Report submitted' });
            }

            if (route === 'gdpr_forget') {
                const { sparkId } = req.body;
                await MarketEngine.forgetSpark(user, sparkId);
                return res.json({ success: true });
            }
            
            if (route === 'delete') { // Legacy POST
                 const { sparkId } = req.body;
                 const result = await MarketEngine.deleteSpark(user, sparkId);
                 return res.json(result);
            }
        }
        
        // --- DELETE Requests ---
        if (req.method === 'DELETE') {
             // Simple path matching: /sparks/:id
             // Since route is e.g. "sparks/65a...", we split
             if (route.startsWith('sparks/')) {
                 const sparkId = route.split('/')[1];
                 const result = await MarketEngine.deleteSpark(user, sparkId);
                 return res.json(result);
             }
        }

        return res.status(404).json({ error: 'Market endpoint not found', route });

    } catch (e) {
        console.error('Market API Error:', e);
        return res.status(500).json({ error: e.message });
    }
};

module.exports = handler;