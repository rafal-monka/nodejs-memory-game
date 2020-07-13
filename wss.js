const url = require('url')
const WebSocket = require('ws');

const auth = require('./auth');
const Game = require('./app/models/game-model')
const gameValidators = require('./app/controllers/game-validators')
const PlayMemoryGame = require('./app/controllers/play-memory-game')

var wss
let playMemoryGames = []

getWssClients = () => {
    return [...wss.clients]
}

getWssClient = (gameid, userid) => {
    return  getWssClients()
            .filter(client => client.clientInfo.gameid === gameid && client.clientInfo.userid === userid)
            .map(client => client.clientInfo)
            .reduce((obj, item) => ({...item}), {})
}

getWssClientEmail = (gameid, email) => {
    console.log('getWssClientEmail', gameid, email)
    return  getWssClients()
            .filter(client => client.clientInfo.gameid === gameid && client.clientInfo.profile.email === email)
            //.map(client => client.clientInfo)
            //reduce((obj, item) => ({...item}), {})
}

getConnectedPlayers = (gameid) => {
    return getWssClients()
           .filter(client => client.clientInfo.gameid === gameid)
           .map(client => client.clientInfo)
}

notifyPlayer = (wssClientID, gameid, msg) => {
    getWssClients()
    .filter(client => client.clientInfo.wssClientID === wssClientID && client.clientInfo.gameid === gameid )
    .forEach(client => {
        client.send( JSON.stringify(msg) ); 
    })
}

notifyOtherPlayers = (wssClientID, gameid, msg) => {
    getWssClients()
    .filter(client => (wssClientID === undefined || client.clientInfo.wssClientID !== wssClientID) && client.clientInfo.gameid === gameid )
    .forEach(client => {
        client.send( JSON.stringify(msg) ); 
    })
}

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

        //@@@AUTH0
        auth.getUserProfile(authToken, (arg) => {        
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

            //disconnect if user is already connected
            let alreadyConnected = getWssClients().findIndex(client => client.clientInfo.profile.email === ws.clientInfo.profile.email 
                                                                       && client.clientInfo.gameid === ws.clientInfo.gameid 
                                                                       && client.clientInfo.wssClientID !== wssClientID)
            //console.log('alreadyConnected', alreadyConnected)
            if (alreadyConnected !== -1) {
                ws.close(1003, 'Disconnected. You are already connected in another session.') 
                return
            }

            Game.findOne({ gameid: gameid })
                .then(function (result) {
                    let retObj = gameValidators.validate(gameid, result, ws.clientInfo.profile.email)
                    if (retObj.status!==200) {
                        console.log('VALIDATION ERROR', retObj.msg)
                        let errorMsg = {
                            event: 'ERROR',
                            payload: retObj.msg
                        }
                        notifyPlayer(wssClientID, gameid, errorMsg)
                    } else {
                        let players = result.players
                        let connectedPlayers = getConnectedPlayers(gameid)
                        let playersInGame = players.map(player => {
                            let obj = {
                                gameid: gameid,
                                level: player.level,
                                userid: player.userid,
                                email: player.email,
                                name: player.name,
                                role: player.role,
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
                        
                        //notify me after connection with the list of players combined with connected wss clients
                        let msg1 = {
                            event: 'CONNECTION',
                            payload: { 
                                wssClientID: wssClientID,
                                playersInGame: playersInGame 
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
                //  .catch (next)
        })    

        ws.on('close', function message(code, msg) {
            msg = {
                event: 'DISCONNECTION',
                payload: {
                    wssClientID: wssClientID //###@@@wssClientID
                }
            }
            notifyOtherPlayers(wssClientID, gameid, msg)
        })
            
        ws.on('message', function message(obj) {
            //###@@@TODO
            //console.log('ws.on(message)', obj)
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
                    console.log('START', msg.value)
                    if (gameid === msg.value) console.log('###Test values should be equal', gameid, msg.value)
                    //update game status and retrieve game document -> findOneAndUpdate -> playGame()
                    Game.findOneAndUpdate({gameid: gameid}, {status: 'STARTED'}, {new: true})
                        .then(function (result) {
                            //###one instance???  
                            //console.log('START', result)                              
                            playMemoryGames[gameid] = new PlayMemoryGame(result, null, wss)
                            playMemoryGames[gameid].playGame() 
                            // response = { 
                            //     event: 'STARTED',
                            //     payload: result
                            // }  
                            //notifyAllPlayers(gameid, response) 
                        })                        
                    break

                case 'CLICKCARD':                    
                    playMemoryGames[gameid].openCard(msg.value.row, msg.value.col)
                    break

                default:
                    response = { 
                        event: 'ERROR',
                        payload: 'Error in wss.on-message'
                    }       
            }            
        });
    });   
}

exports.notifyPlayer = notifyPlayer
exports.notifyOtherPlayers = notifyOtherPlayers
exports.notifyAllPlayers = notifyAllPlayers
exports.getWssClient = getWssClient
exports.getWssClientEmail = getWssClientEmail


//----------------------------------------------------temp
exports.getWssClients = getWssClients

