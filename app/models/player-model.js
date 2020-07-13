
const mongoose = require('mongoose')

module.exports.playerSchema = new mongoose.Schema({ 
    userid: String,  
    role: String, 
    name: String,
    email: String, 
    level: { 
        type: Number,
        default: 0
    }, 
    missed : { 
        type: Number,
        default: 0
    }, 
    score: { 
        type: Number,
        default: 0
    }, 
    crdate: { 
        type: Date,
        default: new Date()
    }
});

module.exports.Player = mongoose.model('Player', this.playerSchema)