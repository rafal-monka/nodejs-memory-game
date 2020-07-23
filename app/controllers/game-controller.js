const email = require("../../email");
const wss = require('../../wss')
const constants = require('../../config/constants');
const utils = require('../../app/utils')
const Game = require('../models/game-model')
const gameValidators = require('./game-validators')


exports.create = (req, res, next) => {
// console.log('req.params.theme',req.params.theme)
    let _setSIZE = [...Array(constants.CONST_SIZE).keys()] 
    let _setCARDS = [...Array(constants.CONST_SIZE*constants.CONST_SIZE/2).keys()]                  
    let cards = [..._setCARDS, ..._setCARDS]  

    let game = new Game( {
        gameid: Date.now().toString(16).toUpperCase(),
        name: 'Game '+new Date(),
        host: req.body.user.email,
        theme: req.params.theme, //'cities', //###
        backgroundImage: utils.randomInteger(0, _setCARDS.length-1)
    })
    
    //insert first player (host = owner)
    game.players = [{
        userid: req.body.user.sub,
        name: req.body.user.name,
        email: req.body.user.email,
        role: 'HOST'
    }]

    //set board 
    game.board = [...Array(constants.CONST_SIZE)].map(e => Array(constants.CONST_SIZE).fill(0))
    game.cardsLeft = cards.length
    _setSIZE.forEach(row => {
        _setSIZE.forEach(col => {
            let inx = utils.randomInteger(0, cards.length-1)
            let val = cards.splice(inx, 1)[0]
            game.board[row][col] = {value: val, count: 0}
        })
    })

    //set current step and player to 0 
    game.currentStep = 0
    game.currentPlayerInx = 0 
    
    //save to DB
    game.save()
        .then(function (result ){
            res.status(200).json(result)
        })
        .catch (next)  
}

exports.getAll = (req, res, next) => {  
        Game.find({})
        .then(function (result) {
            res.status(200).json(result)
        })
        .catch (next) 
}

exports.get = (req, res, next) => { 
    Game.findOne({ gameid: req.params.gameid })
        .then(function (result) {
            let retObj = gameValidators.validate(req.params.gameid, result, req.session.userProfile.email/*req.userProfile.email*/)
            res.status(retObj.status).json(retObj.msg)
        })
        .catch (next) 
}

exports.update = (req, res, next) => {
//    console.log('update game', req.params.gameid, req.body)
    const gameid = req.params.gameid;
    Game.findOneAndUpdate({gameid: gameid}, req.body, {new: true})
        .then(function (result) {
            res.json(result)
        })
        .catch (next) 
}


exports.addPlayer = async (req, res, next) => { 
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

        let wssClientID = wss.getWssClient(req.body.gameid, req.session.userProfile.sub/*req.userProfile.sub*/).wssClientID
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
        let wssClientID = wss.getWssClient(req.body.gameid, req.session.userProfile.sub/*req.userProfile.sub*/).wssClientID
        let msg = {
            event: 'PLAYER_REMOVED_FROM_GAME',
            payload: {                
                email: req.body.email
            }
        }
        wss.notifyOtherPlayers(wssClientID, req.body.gameid, msg)
        //notify removed player (force disconnection?)
        let removedWssClient = wss.getWssClientEmail(req.body.gameid, req.body.email)
        if (removedWssClient.length === 1) {
            let errorMsg = {
                event: 'ERROR',
                payload: 'User '+req.session.userProfile.email/*req.userProfile.email*/+' has been removed from game. You are being disconnected.'
            }
            wss.notifyPlayer(removedWssClient[0].clientInfo.wssClientID, req.body.gameid, errorMsg)
            removedWssClient[0].close(1002, 'Disconnected. You have been removed from game') //###SERVER or CLIENT 
        }
        res.status(200).json({status: 'REMOVED'}) //###const
    }
    //###???.catch (next) 
}


//-----------------------temp
