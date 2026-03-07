const express = require('express');
const router = express.Router();
const userController = require('../../controllers/userController');


router.get('/',                   userController.listUsers);
router.get('/search',             userController.searchUsers);
router.get('/export',             userController.exportUsers);
router.get('/:userId',            userController.getSingleUser);
router.patch('/:userId/role',     userController.updateUserRole);
router.patch('/:userId/status',   userController.updateUserStatus);
router.post('/bulk/action',       userController.bulkUserAction);
router.delete('/:userId',         userController.deleteUser);

module.exports = router;