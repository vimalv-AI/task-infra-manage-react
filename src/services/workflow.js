const db = require('../database/db');

const STATUS = {
  SUBMITTED: 'Submitted',
  PENDING: 'Pending Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  PROVISIONING: 'Provisioning',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
};

const getStatus = db.prepare('SELECT status FROM service_requests WHERE id = ?');
const setStatus = db.prepare('UPDATE service_requests SET status = ? WHERE id = ?');
const addHistory = db.prepare(
  `INSERT INTO request_history (request_id, old_status, new_status, changed_by, note, created_at)
   VALUES (?, ?, ?, ?, ?, ?)`
);

// Updates the status and writes a history row in a single transaction
const changeStatus = db.transaction((requestId, newStatus, changedBy = null, note = null) => {
  const row = getStatus.get(requestId);
  if (!row) throw new Error('Request not found');
  setStatus.run(newStatus, requestId);
  addHistory.run(requestId, row.status, newStatus, changedBy, note, new Date().toISOString());
});

module.exports = { STATUS, changeStatus, addHistory };
