const db = require('../database/db');
const { STATUS, changeStatus } = require('./workflow');

// Local simulator: no real infrastructure is touched.
// Approved -> Provisioning -> Completed (or Failed, based on FAIL_RATE)
const START_DELAY_MS = 3000;
const FINISH_DELAY_MS = 7000;

function start(requestId) {
  setTimeout(() => {
    try {
      changeStatus(requestId, STATUS.PROVISIONING, null, 'Provisioning started (simulated)');
    } catch (e) {
      console.error('Provisioner error:', e.message);
      return;
    }

    setTimeout(() => {
      try {
        const failRate = Number(process.env.FAIL_RATE || 0);
        if (Math.random() < failRate) {
          changeStatus(requestId, STATUS.FAILED, null, 'Simulated provisioning failure');
        } else {
          changeStatus(requestId, STATUS.COMPLETED, null, 'Virtual machine is ready (simulated)');
        }
      } catch (e) {
        console.error('Provisioner error:', e.message);
      }
    }, FINISH_DELAY_MS);
  }, START_DELAY_MS);
}

// If the server restarts mid-flight, pick up unfinished work
function resumePending() {
  const rows = db
    .prepare('SELECT id FROM service_requests WHERE status IN (?, ?)')
    .all(STATUS.APPROVED, STATUS.PROVISIONING);
  rows.forEach((r) => start(r.id));
  if (rows.length) console.log(`Resumed provisioning for ${rows.length} request(s)`);
}

module.exports = { start, resumePending };
