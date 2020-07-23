const url = require('url')
const WebSocket = require('ws');

const auth = require('./auth');
const Game = require('./app/models/game-model')
const gameValidators = require('./app/controllers/game-validators')//###???
const PlayMemoryGame = require('./app/controllers/play-memory-game');
//const { get } = require('http');

var wss //web socket server
let playMemoryGames = [] //array of currently played memory games 

//Return array of all wss clients
getWssClients = () => {
    return [...wss.clients]
}

//Return object of wss client for a given game and player's userid (auth.profile.sub)  
getWssClient = (gameid, userid) => {
    return  getWssClients()
            .filter(client => client.clientInfo.gameid === gameid && client.clientInfo.userid === userid)
            .map(client => client.clientInfo)
            .reduce((obj, item) => ({...item}), {})
}

//Return array of wss clients for a given game and player's email
//###convert from array to object
getWssClientEmail = (gameid, email) => {
//console.log('###getWssClientEmail', gameid, email)
    return  getWssClients()
            .filter(client => client.clientInfo.gameid === gameid && client.clientInfo.profile.email === email)
            //.map(client => client.clientInfo)
            //reduce((obj, item) => ({...item}), {})
}

//Return array of wss clients containg only client.clientInfo 
getConnectedPlayers = (gameid) => {
    return getWssClients()
           .filter(client => client.clientInfo.gameid === gameid)
           .map(client => client.clientInfo)
}

getPlayersInGame = (gameid, players) => {
    let connectedPlayers = getConnectedPlayers(gameid)
    let playersInGame = players.map(player => {
        let obj = {
            gameid: gameid,
            level: player.level, //###???...player
            userid: player.userid,
            email: player.email,
            name: player.name,
            role: player.role,
            score: player.score,
            missed: player.missed,
            connected: player.level>0
        }                        
        let index = connectedPlayers.findIndex(cp => player.email === cp.profile.email && cp.gameid === gameid )
        if (index === -1) {
            obj.wssClientID = null
            obj.connected = (player.level > 0)                            
        } else {                         
            obj.wssClientID = connectedPlayers[index].wssClientID
            obj.userid = connectedPlayers[index].userid
            obj.name = connectedPlayers[index].profile.name
            obj.connected = true
        }  
        return obj                      
    })
    return playersInGame
}

//Notify specified wss client for a given game
notifyPlayer = (wssClientID, gameid, msg) => {
    getWssClients()
    .filter(client => client.clientInfo.wssClientID === wssClientID && client.clientInfo.gameid === gameid )
    .forEach(client => {
        client.send( JSON.stringify(msg) ); 
    })
}

//Notify all other wss clients for a given game except current wss client
notifyOtherPlayers = (wssClientID, gameid, msg) => {
    getWssClients()
    .filter(client => (wssClientID === undefined || client.clientInfo.wssClientID !== wssClientID) && client.clientInfo.gameid === gameid )
    .forEach(client => {
        client.send( JSON.stringify(msg) ); 
    })
}

//Notify all wss clients for a given game
notifyAllPlayers = (gameid, msg) => {
    getWssClients()
    .filter(client => client.clientInfo.gameid === gameid )
    .forEach(client => {
        client.send( JSON.stringify(msg) ); 
    })
}

exports.init = (server) => {
    console.log('Starting WSS server')
    wss = new WebSocket.Server(/*{ noServer: true }*/{server : server});
    wss.on('connection', function connection(ws, request) {
        let authToken = url.parse(request.url,true).query.token 
        let wssClientID = request.headers['sec-websocket-key'] 
        let gameid = url.parse(request.url,true).query.gameid
        let userid = url.parse(request.url,true).query.userid      
//console.log('on-connection, gameid=', gameid)
        try {
            //@@@AUTH0
            auth.getUserProfile(authToken, (arg) => {   

                //@@@AUTH0
                //arg = {email: 'monka.rafal@gmail.com', name: 'RM-auth.getUserProfile', email_verified: true}             
                ws.clientInfo = {
                    gameid: gameid,
                    wssClientID: wssClientID, 
                    userid: userid,
                    profile: { 
                        email: arg.email, 
                        name: arg.name, 
                        email_verified: arg.email_verified
                    }
                }

            //@@@AUTH0
            // if (!authToken) {
            //     console.log('Notify TEST')
            //     ws.send(JSON.stringify({event: 'WSS-MODULE-LEARNING'}))            

                //disconnect if user is already connected
                let alreadyConnected = getWssClients().findIndex(client => client.clientInfo.profile.email === ws.clientInfo.profile.email 
                                                                        && client.clientInfo.gameid === ws.clientInfo.gameid 
                                                                        && client.clientInfo.wssClientID !== wssClientID)
                if (alreadyConnected !== -1) {
                    ws.close(1003, 'Disconnected. You are already connected in another session.') 
                    return
                }

                Game
                .findOne({ gameid: gameid })
                .then(function (result) {
                    //??? gameValidators.validate -> class PlayMemoryGame 
                    let retObj = gameValidators.validate(gameid, result, ws.clientInfo.profile.email)
                    if (retObj.status!==200) {
                        console.log('###VALIDATION ERROR', retObj.msg)
                        let errorMsg = {
                            event: 'ERROR',
                            payload: retObj.msg
                        }
                        notifyPlayer(wssClientID, gameid, errorMsg)
                    } else {
                        //###DEL: let players = result.players
                        let playersInGame = getPlayersInGame(gameid, result.players)
                        
                        //notify me after connection with the list of players combined with connected wss clients
                        let msg1 = {
                            event: 'CONNECTION',
                            payload: { 
                                wssClientID: wssClientID,
                                playersInGame: playersInGame,
                                game: result
                            }
                        }
                        notifyPlayer(wssClientID, gameid, msg1)
                        
                        //notify other players with me connected
                        let msg2 = {
                            event: 'NEW_PLAYER_CONNECTED', 
                            payload: {    
                                playerConnected: ws.clientInfo 
                            }
                        }
                        notifyOtherPlayers(wssClientID, gameid, msg2)
                    } 
                })
                //###.catch (next)

            // } 
            
            }) //@@@AUTH0

        } catch(err) {
            console.log(err)
            //notifyPlayer(wssClientID, gameid, err)
            ws.send( JSON.stringify(err) )    
        }

        ws.on('close', function message(code, msg) {
// console.log('closing', wssClientID, ws.clientInfo.profile.email)
            let res = {
                event: 'DISCONNECTION',
                payload: {
                    wssClientID: wssClientID,
                    email: ws.clientInfo.profile.email 
                }
            }
            notifyOtherPlayers(wssClientID, gameid, res)
        })
            
        ws.on('message', function message(obj) {
// console.log('on-message', obj)
            let msg = JSON.parse(obj)
            let response
            switch (msg.action) {
                case 'TEST': //###TO-DELETE
                    response = { 
                        event: 'TEST',
                        payload: 'RE: '+msg.value.toUpperCase()
                    }  
                    notifyAllPlayers(gameid, response)
                    break

                case 'START':                  
                    playMemoryGames[gameid] = new PlayMemoryGame(gameid, null, ()=>playMemoryGames[gameid].playGame())
                    break

                case 'CLICKCARD':
                    if (playMemoryGames[gameid] === undefined) {
                        playMemoryGames[gameid] = new PlayMemoryGame(gameid, null, ()=>playMemoryGames[gameid].openCard(msg.value.row, msg.value.col))  
                    } else {
                        playMemoryGames[gameid].openCard(msg.value.row, msg.value.col)
                    }
                    break

                case 'PING':
                    //@@@AUTH0
                    response = {
                        event: 'PING-RESPONSE',
                        payload: msg.value.toUpperCase()
                    }
                    ws.send(JSON.stringify(response))  
                    break

                default:
                    response = { 
                        event: 'ERROR',
                        payload: 'Error in wss.on-message'+ JSON.stringify(msg)
                    }    
                    notifyAllPlayers(gameid, response)
                      
            }            
        });
    });   
}

exports.notifyPlayer = notifyPlayer
exports.notifyOtherPlayers = notifyOtherPlayers
exports.notifyAllPlayers = notifyAllPlayers
exports.getWssClient = getWssClient
exports.getWssClientEmail = getWssClientEmail
exports.getPlayersInGame = getPlayersInGame

//----------------------------------------------------temp
exports.getWssClients = getWssClients

