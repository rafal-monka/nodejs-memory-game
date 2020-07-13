const email = require("../../email");
const wss = require('../../wss')

const Game = require('../models/game-model')
const gameValidators = require('./game-validators')


exports.create = (req, res, next) => {
    let game = new Game( {
        gameid: Date.now().toString(16).toUpperCase(),
        name: 'Game '+new Date(),
        host: req.body.user.sub 
    })
    game.players = [{
        userid: req.body.user.sub,
        name: req.body.user.name,
        email: req.body.user.email,
        role: 'HOST'
    }]
    game.save()
        .then(function (result ){
            res.status(200).json(result)
        })
        .catch (next)  
}

exports.getAll = (req, res, next) => {  
        console.log('getAll()')
        Game.find({})
        .then(function (result) {
            res.status(200).json(result)
        })
        .catch (next) 
}

exports.get = (req, res, next) => { 
    console.log('get()')
    Game.findOne({ gameid: req.params.gameid })
        .then(function (result) {
            let retObj = gameValidators.validate(req.params.gameid, result, req.userProfile.email)
            res.status(retObj.status).json(retObj.msg)
            // if (!result) {
            //     res.status(404).json( {msg: 'No data for game #'+req.params.gameid})                
            // } else {
            //     let index = result.players.findIndex(player => player.email === req.userProfile.email)
            //     if (index === -1) {
            //         res.status(404).json( {msg: 'User '+req.userProfile.email+' is not a player in game #'+req.params.gameid})
            //     } else {
            //         res.status(200).json(result)
            //     }
            // }
        })
        .catch (next) 
}

exports.update = (req, res, next) => {
    console.log('update game', req.params.gameid, req.body)
    const gameid = req.params.gameid;
    Game.findOneAndUpdate({gameid: gameid}, req.body, {new: true})
        .then(function (result) {
            res.json(result)
        })
        .catch (next) 
}


exports.addPlayer = async (req, res, next) => { 
    console.log('addPlayer')
    let game = await Game.findOne({ gameid: req.body.gameid })
    let index = game.players.findIndex(player => player.email.toUpperCase() === req.body.email.toUpperCase()) 
    if (index > -1) {
        res.status(404).json( {msg: 'Player '+req.body.email+' already exists'} )
    } else {
        let isComputer = req.body.level > 0
        let player = {
            userid: req.body.userid,
            email: req.body.email,
            name:  req.body.name,
            role:  isComputer ? 'COMPUTER' : 'HUMAN',
            level: req.body.level,
            connected: isComputer
        }
        game.players.push(player)
        await game.save()

        let wssClientID = wss.getWssClient(req.body.gameid, req.userProfile.sub).wssClientID
        let msg = {
            event: 'PLAYER_ADDED_TO_GAME', 
            payload: {                 
                player: player 
            }
        }        
        wss.notifyOtherPlayers(wssClientID, req.body.gameid, msg) 
        //@@@email.sendEmail(req.body.email, '[MemoryGame] Play game', '<a href=\''+'http://localhost:4200/wss/'+req.body.gameid+'\'>Click here</a>');
        res.status(200).json(player)
    }
    //###???.catch (next) 
}

exports.removePlayer = async (req, res, next) => { 
    let game = await Game.findOne({ gameid: req.body.gameid })
    let index = game.players.findIndex(item => item.email === req.body.email)  
    if (index === -1) {
        throw new Error('Player '+req.body.email+' NOT FOUND')
    } else {
        game.players.splice(index, 1)
        await game.save()
        let wssClientID = wss.getWssClient(req.body.gameid, req.userProfile.sub).wssClientID
        let msg = {
            event: 'PLAYER_REMOVED_FROM_GAME',
            payload: {                
                email: req.body.email
            }
        }
        wss.notifyOtherPlayers(wssClientID, req.body.gameid, msg)
        //notify removed player (force disconnection?)
        let removedWssClient = wss.getWssClientEmail(req.body.gameid, req.body.email)
        console.log('removedWssClient', removedWssClient.length)
        if (removedWssClient.length === 1) {
            let errorMsg = {
                event: 'ERROR',
                payload: 'User '+req.userProfile.email+' has been removed from game. You are being disconnected.'
            }
            wss.notifyPlayer(removedWssClient[0].clientInfo.wssClientID, req.body.gameid, errorMsg)
            removedWssClient[0].close(1002, 'Disconnected. You have been removed from game') //###SERVER or CLIENT 
        }
        res.status(200).json({status: 'REMOVED'}) //###const
    }
    // ???.catch (next) 
}


//-----------------------temp
//exports.newGame = () => {
//     let game = new Game({})
//     game.save()
//         .then(function (result ){
//             console.log(result)
//         })
//         .catch (next)
// }

//wssClientID: wssClientID, 
//userid: req.userProfile.sub, 

// //wssClientID: wssClientID, 
// //userid: req.userProfile.sub,                
// email: req.body.email//,
// //index: index 