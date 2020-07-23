
const mongoose = require('mongoose')

const themeSchema = new mongoose.Schema({ 
    name: String,
    crdate: { 
        type: Date,
        default: new Date()
    }
});

module.exports = mongoose.model('Theme', themeSchema)