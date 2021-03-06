const express = require('express')
const router = express.Router()
const GameController = require('../controllers/game-controller.js')

router.get('/play/:gameid', GameController.get) //###only for testing

router.post('/:theme', GameController.create)
router.get('/', GameController.getAll)
router.get('/:gameid', GameController.get)

router.put('/player', GameController.addPlayer)
router.put('/:gameid', GameController.update) 

router.delete('/player', GameController.removePlayer) 

module.exports = router