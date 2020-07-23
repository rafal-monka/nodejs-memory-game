const express = require('express')
const router = express.Router()
const ThemeController = require('../controllers/theme-controller.js')

router.get('/', ThemeController.getAll)

module.exports = router