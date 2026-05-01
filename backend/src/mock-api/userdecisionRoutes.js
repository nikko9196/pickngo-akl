// API routes
// import express from 'express';
// import { getUserDecision} from './userspinController.js';

// const router = express.Router();

// router.get('/:sessionid/:spin_no', getUserDecision);

// export default router;

const express = require('express');
const { getUserDecision } = require('./userspinController.js');

const router = express.Router();

router.get('/:sessionid/:spin_no', getUserDecision);

module.exports = router;