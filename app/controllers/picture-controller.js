const Picture = require('./../models/picture-model')

exports.get = (req, res, next) => {  
    Picture.find({theme: req.params.theme}) 
        .then(function (result) {
            res.status(200).json(result)
        })
        .catch (next) 
}

