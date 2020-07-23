const Theme = require('./../models/theme-model')

exports.getAll = (req, res, next) => {  
    Theme.find({}) 
        .then(function (result) {
            res.status(200).json(result)
        })
        .catch (next) 
}

