exports.notFound = (req, res) => res.json({status: 'fail', code: '404'})
exports.serverError = (err, req, res, next) => res.json({status: 'fail', code: '500', msg: err.stack})


