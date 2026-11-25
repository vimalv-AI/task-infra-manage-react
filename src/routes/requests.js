const express = require('express');
const db = require('../database/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { STATUS, changeStatus } = require('../services/workflow');
const provisioner = require('../services/provisioner');

const router = express.Router();
router.use(requireAuth);

const OS_OPTIONS = ['Ubuntu 22.04', 'Ubuntu 24.04', 'Debian 12', 'Rocky Linux 9', 'Windows Server 2022'];

function isWholeNumberInRange(value, min, max) {
  const num = Number(value);
  return Number.isInteger(num) && num >= min && num <= max;
}

function validate(body) {
  const errors = [];
  const data = body || {};

  if (!data.request_name || !/^[a-zA-Z0-9-]{3,40}$/.test(data.request_name)) {
    errors.push('Request name must be 3-40 characters: letters, numbers and hyphens only');
  }
  if (!OS_OPTIONS.includes(data.os)) {
    errors.push('Choose a valid operating system');
  }
  if (!isWholeNumberInRange(data.cpu, 1, 16)) {
    errors.push('cpu must be a whole number between 1 and 16');
  }
  if (!isWholeNumberInRange(data.ram_gb, 1, 64)) {
    errors.push('ram_gb must be a whole number between 1 and 64');
  }
  if (!isWholeNumberInRange(data.storage_gb, 10, 1000)) {
    errors.push('storage_gb must be a whole number between 10 and 1000');
  }
  if (!data.reason || String(data.reason).trim().length < 5 || String(data.reason).length > 300) {
    errors.push('Business reason must be 5-300 characters');
  }

  return errors;
}

// POST /api/requests
router.post('/', (req, res) => {
  const errors = validate(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join('. '), details: errors });

  const { request_name, os, cpu, ram_gb, storage_gb, reason } = req.body;

  const create = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO service_requests
         (user_id, service_type, request_name, os, cpu, ram_gb, storage_gb, reason, status, created_at)
         VALUES (?, 'Virtual Machine', ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(req.user.id, request_name, os, cpu, ram_gb, storage_gb, String(reason).trim(), STATUS.SUBMITTED, new Date().toISOString());

    const id = info.lastInsertRowid;
    db.prepare(
      `INSERT INTO request_history (request_id, old_status, new_status, changed_by, note, created_at)
       VALUES (?, NULL, ?, ?, 'Request submitted', ?)`
    ).run(id, STATUS.SUBMITTED, req.user.id, new Date().toISOString());

    changeStatus(id, STATUS.PENDING, null, 'Waiting for administrator approval');
    return id;
  });

  const id = create();
  res.status(201).json(db.prepare('SELECT * FROM service_requests WHERE id = ?').get(id));
});

// GET /api/requests            -> requests of the signed-in user
// GET /api/requests?all=true   -> all requests (admin only)
router.get('/', (req, res) => {
  const wantAll = req.query.all === 'true';
  if (wantAll && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }

  const sql = `
    SELECT r.*, u.name AS requester
    FROM service_requests r JOIN users u ON u.id = r.user_id
    ${wantAll ? "WHERE u.role = 'user'" : 'WHERE r.user_id = ?'}
    ORDER BY r.id DESC`;
  const rows = wantAll ? db.prepare(sql).all() : db.prepare(sql).all(req.user.id);
  res.json(rows);
});

// GET /api/requests/:id
router.get('/:id', (req, res) => {
  const request = db
    .prepare(
      `SELECT r.*, u.name AS requester FROM service_requests r
       JOIN users u ON u.id = r.user_id WHERE r.id = ?`
    )
    .get(req.params.id);

  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'You cannot view this request' });
  }

  const history = db
    .prepare(
      `SELECT h.*, u.name AS changed_by_name FROM request_history h
       LEFT JOIN users u ON u.id = h.changed_by
       WHERE h.request_id = ? ORDER BY h.id ASC`
    )
    .all(req.params.id);

  res.json({ ...request, history });
});

function decide(newStatus, defaultNote) {
  return (req, res) => {
    const request = db.prepare('SELECT * FROM service_requests WHERE id = ?').get(req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== STATUS.PENDING) {
      return res.status(409).json({ error: `Request is already ${request.status}` });
    }

    const note = (req.body && req.body.note && String(req.body.note).slice(0, 300)) || defaultNote;
    changeStatus(request.id, newStatus, req.user.id, note);

    if (newStatus === STATUS.APPROVED) provisioner.start(request.id);

    res.json(db.prepare('SELECT * FROM service_requests WHERE id = ?').get(request.id));
  };
}

// PATCH /api/requests/:id/approve  (admin)
router.patch('/:id/approve', requireRole('admin'), decide(STATUS.APPROVED, 'Approved by administrator'));
// PATCH /api/requests/:id/reject   (admin)
router.patch('/:id/reject', requireRole('admin'), decide(STATUS.REJECTED, 'Rejected by administrator'));

module.exports = router;
