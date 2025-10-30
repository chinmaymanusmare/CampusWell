const express = require('express');
const router = express.Router();

const {
  submitConcern,
  getConcernsForStudent,
  getConcernsForDoctor,
  replyToConcern
} = require('../controllers/concernController');

const verifyToken = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

router.post('/', verifyToken, authorize('student'), submitConcern);
router.get('/student', verifyToken, authorize('student'), getConcernsForStudent);
router.get('/doctor', verifyToken, authorize('doctor'), getConcernsForDoctor);
router.post('/:id/reply', verifyToken, authorize('doctor'), replyToConcern);

module.exports = router;
