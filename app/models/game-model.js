
const mongoose = require('mongoose')
const player = require('../models/player-model')

const gameSchema = new mongoose.Schema({ 
    gameid: {
        type: String,
        unique: true
    },  
    status: {
        type: String,
        default: 'NEW'
    },
    name: String,
    host: String,
    players: [player.playerSchema],
    board: [Array],
    /*openCards: Array,*/
    currentStep: {
        type: Number,
        default: 0
    },
    currentPlayerInx: {
        type: Number,
        default: 0
    },
    cardsLeft: {
        type: Number,
        default: null
    },
    backgroundImage: Number,
    theme: String,
    crdate: { 
        type: Date,
        default: new Date()
    }
});

module.exports = mongoose.model('Game', gameSchema)