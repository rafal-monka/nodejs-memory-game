const express = require('express')
const router = express.Router()
const PictureController = require('../controllers/picture-controller.js')

router.get('/:theme', PictureController.get)

module.exports = router