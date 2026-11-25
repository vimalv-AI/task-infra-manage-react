const express = require('express');
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard/summary
// Admins see counts for everyone; users see their own.
router.get('/summary', requireAuth, (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const rows = isAdmin
    ? db
        .prepare(
          `SELECT r.status, COUNT(*) AS n
           FROM service_requests r
           JOIN users u ON u.id = r.user_id
           WHERE u.role = 'user'
           GROUP BY r.status`
        )
        .all()
    : db
        .prepare('SELECT status, COUNT(*) AS n FROM service_requests WHERE user_id = ? GROUP BY status')
        .all(req.user.id);

  const byStatus = Object.fromEntries(rows.map((r) => [r.status, r.n]));
  const total = rows.reduce((sum, r) => sum + r.n, 0);

  res.json({
    scope: isAdmin ? 'all' : 'mine',
    total,
    pending: byStatus['Pending Approval'] || 0,
    inProgress: (byStatus['Approved'] || 0) + (byStatus['Provisioning'] || 0),
    completed: byStatus['Completed'] || 0,
    failed: (byStatus['Failed'] || 0) + (byStatus['Rejected'] || 0),
    byStatus,
  });
});

module.exports = router;
