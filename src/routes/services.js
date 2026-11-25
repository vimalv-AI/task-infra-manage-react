const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const SERVICES = [
  {
    id: 'virtual-machine',
    name: 'Virtual Machine',
    description: 'Provision a Linux or Windows server with the CPU, memory and storage you need.',
    icon: 'bi-hdd-rack',
    available: true,
    eta: '~10 seconds (simulated)',
  },
  {
    id: 'object-storage',
    name: 'Object Storage',
    description: 'S3-style buckets for backups, logs and static assets.',
    icon: 'bi-bucket',
    available: false,
  },
  {
    id: 'database',
    name: 'Managed Database',
    description: 'PostgreSQL or MySQL instances with automated backups.',
    icon: 'bi-database',
    available: false,
  },
  {
    id: 'kubernetes',
    name: 'Kubernetes Cluster',
    description: 'Small managed clusters for containerised workloads.',
    icon: 'bi-boxes',
    available: false,
  },
];

// GET /api/services
router.get('/', requireAuth, (req, res) => res.json(SERVICES));

module.exports = router;
