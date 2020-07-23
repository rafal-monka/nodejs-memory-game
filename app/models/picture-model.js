
const mongoose = require('mongoose')

const pictureSchema = new mongoose.Schema({ 
    theme: String,
    number: Number,
    imgsrc: String,
    crdate: { 
        type: Date,
        default: new Date()
    }
});

module.exports = mongoose.model('Picture', pictureSchema)