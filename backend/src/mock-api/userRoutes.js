// API routes
// import express from 'express';
// import { getHost} from './userspinController.js';

// const router = express.Router();

// router.get('/:sessionid/:userid', getHost);

// export default router;

const express = require('express');
const { getHost } = require('./userspinController.js');

const router = express.Router();

router.get('/:sessionid/:userid', getHost);

module.exports = router;