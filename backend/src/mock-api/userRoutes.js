// API routes
import express from 'express';
import { getHost} from './userspinController.js';

const router = express.Router();

router.get('/:sessionid/:userid', getHost);

export default router;