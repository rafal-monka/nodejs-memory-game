exports.validate = (gameid, result, email) => {
    let obj = {
        status: 200,
        msg: result
    }
    if (!result) {
        //res.status(404).json( {msg: 'No data for game #'+req.params.gameid})
        obj.status = 404
        obj.msg = 'Validation. No data for game #'+gameid               
    } else {
        let index = result.players.findIndex(player => player.email === email)
        if (index === -1) {
            obj.status = 404
            obj.msg = 'Validation. User '+email+' is not a player in game #'+gameid    
            //res.status(404).json( {msg: 'User '+req.userProfile.email+' is not a player in game #'+req.params.gameid})
        }
    }
    return obj
}