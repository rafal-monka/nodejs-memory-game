const Game = require('./../models/game-model')
const Computer = require('./computer')
const utils = require('../utils')
const constants = require('./../../config/constants');
const wss = require('./../../wss')

module.exports = class PlayMemoryGame {

    constructor(gameid, res, callback) {
        let self = this
        Game.findOneAndUpdate({gameid: gameid}, {status: 'STARTED'}, {new: true})
            .then(function (result) {    
                self.game = result                     
                self.res = res     
                self.computer = new Computer(self)
                self.waiting = false
                self.openCards = [] //###error when disconnect and when one card is open - ??? 
                try {
                    callback() //self.playGame()
                } catch (error) {
                    if (self.res) self.res.status(404).json({msg: error.stack})
                } 
            })
    }
    
    //Send web socket notification to all (connected) players
    sendWSEvent(event, value) {
        wss.notifyAllPlayers(this.game.gameid, { 
            event: event,
            payload: value
        } )
    }

    //Main function to play game - start players' moves; if current player is:
    // - human: await for GUI click of human player or 
    // - computer: play computer move
    playGame() {        
// console.log('playGame()')
        if (this.game.board.length === 0) {
            console.log('###NO BOARD DATA. CAN NOT PLAY GAME')
            throw new Error('NO BOARD DATA. CAN NOT PLAY GAME')
        }         
        this.sendWSEvent('RESUME', {
            game: this.game, //###???gameid, status, name, currentStep, currentPlayerInx, cardsLeft, 
            //###???board: this.game.board
            playersInGame: wss.getPlayersInGame(this.game.gameid, this.game.players) 
        } )        
        this.possibleComputerMove()
    }
    
    //Check whether current player is Computer and then perform a move
    possibleComputerMove() {
        if (this.game.players[this.game.currentPlayerInx].role === 'COMPUTER') {
            this.computer.computerMove() 
        }
    }
    

    //Open one card on board; and, if this is the second card, check if two cards are the same 
    openCard(r,c) {
        if (this.waiting) {
            console.log('###WAITING...')
            return
        }
        if (this.game.board[r][c].value >= 0) {
            this.game.board[r][c].count++
            this.openCards[this.game.currentStep] = {
                row: r,
                col: c,
                value: this.game.board[r][c].value,
                count: this.game.board[r][c].count
            }
            this.game.board[r][c].value = constants.CONST_OPEN

            let retVal = this.openCards[this.game.currentStep].value            
            let curStep = this.game.currentStep

            //set next step
            this.game.currentStep = (curStep === 0 ? 1 : 0)

            //@@@save into DB. then()
            //->game.board[r][c].count = this.game.board[r][c].count
            //->game.board[r][c].value = constants.CONST_OPEN
            //->game.openCards[curStep]: this.openCards[curStep]
            //->???game.currentStep = this.game.currentStep
            this.sendWSEvent('OPENCARD', {
                openCard: this.openCards[curStep]
            })

            //check if 2 cards are the same
            if (curStep === 1) {
                this.waiting = true
                if (this.openCards[0].value === this.openCards[1].value ) {
                    this.takeCards()
                } else {
                    this.putBackCards()
                }
            }
            return retVal
        } else {
            return null
        }
    }

    //Take cards from board and increase player's score, and also decrease number of cards left on the board
    takeCards() {
        let self = this
        this.game.players[this.game.currentPlayerInx].score += 2
        this.game.cardsLeft -= 2        
        this.game.status = (this.game.cardsLeft===0 ? 'ENDED' : this.game.status)

        //DB storage
        let setFields = {}
        setFields['players.'+this.game.currentPlayerInx+'.score'] = this.game.players[this.game.currentPlayerInx].score
        setFields['board.'+self.openCards[0].row+'.'+self.openCards[0].col+'.value'] = constants.CONST_TAKEN
        setFields['board.'+self.openCards[1].row+'.'+self.openCards[1].col+'.value'] = constants.CONST_TAKEN
        Game.updateOne(
            { gameid: this.game.gameid}, 
            { 
                cardsLeft: this.game.cardsLeft,
                status: this.game.status,
                $set: setFields 
            },
            {new: true}
        )
        .then(function (result) { 
            setTimeout(()=>{

                self.sendWSEvent('TAKECARDS', {
                    openCards: self.openCards, 
                    cardsLeft: self.game.cardsLeft,
                    currentPlayerInx: self.game.currentPlayerInx, 
                    playerScore: self.game.players[self.game.currentPlayerInx].score 
                })  

                //###nie podmieniaj całej board! self.game.board = result.board
                self.game.board[self.openCards[0].row][self.openCards[0].col].value = constants.CONST_TAKEN
                self.game.board[self.openCards[1].row][self.openCards[1].col].value = constants.CONST_TAKEN

                self.openCards = []
                self.waiting = false                 

                //End of game?
                if (self.game.status === 'ENDED') {
    console.log('###GAME OVER - destroy instance of Play Mamory Game???')                   
                    self.sendWSEvent('GAMEOVER', {
                        stats: self.game.players,
                        status: self.game.status
                    })
                    //###???playMemoryGames[self.game.gameid] = null //destroy instance of Play Mamory Game 
                    if (self.res !== null) self.res.status(200).json(self.game) //###only for testing TO-DELETE

                } else {
                    self.possibleComputerMove()
                }

            }, constants.CONST_WAITING_TIME)

        })
    }

    //Put cards back to the board, and increase player's missed 
    putBackCards() {
        let self = this
        let curPlayerInx = this.game.currentPlayerInx
        this.game.players[curPlayerInx].missed += 2;

        //next player
        if (this.game.currentPlayerInx < this.game.players.length-1) {
            this.game.currentPlayerInx++
        } else {
            this.game.currentPlayerInx = 0
        }

        //DB storage
        let setFields = {}
        setFields['players.'+curPlayerInx+'.missed'] = this.game.players[curPlayerInx].missed
        Game.updateOne(
            { gameid: this.game.gameid}, 
            { 
                currentPlayerInx: this.game.currentPlayerInx,
                cardsLeft: this.game.cardsLeft,
                $set: setFields 
            },
            {new: true}
        )
        .then(function (result) { 
            
            setTimeout(()=>{

                self.sendWSEvent('PUTBACKCARDS', {
                    openCards: self.openCards,
                    currentPlayerInx: curPlayerInx,
                    playerMissed: self.game.players[curPlayerInx].missed
                })

                self.game.board[self.openCards[0].row][self.openCards[0].col].value = self.openCards[0].value
                self.game.board[self.openCards[1].row][self.openCards[1].col].value = self.openCards[1].value
                self.openCards = []
                self.waiting = false

                self.sendWSEvent('NEXTPLAYER', {
                    currentPlayerInx: self.game.currentPlayerInx,
                    player: self.game.players[self.game.currentPlayerInx],
                })                

                self.possibleComputerMove()

            }, constants.CONST_WAITING_TIME)

        })
    }

}

//[eof]

//-------------------temp

// self.game.players = [
//     //{userid: '1', name: 'Aaa', role: 'HUMAN', score: 0, missed: 0},
//     {userid: '0', name: 'Atari', role: 'COMPUTER', score: 0, missed: 0, level: 0 },
//     //{userid: '1', name: 'Spectrum', role: 'COMPUTER', score: 0, missed: 0, level: 10 },
//     //{userid: '2', name: 'Amiga', role: 'COMPUTER', score: 0, missed: 0, level: 20 },
//     //{userid: '3', name: 'Win', role: 'COMPUTER', score: 0, missed: 0, level: 30},
//     //{userid: '4', name: 'Linux', role: 'COMPUTER', score: 0, missed: 0, level: 40 },
//     {userid: '5', name: 'Android', role: 'COMPUTER', score: 0, missed: 0, level: 50 },
//     //{userid: '6', name: 'Power', role: 'COMPUTER', score: 0, missed: 0, level: 60 },
//     {userid: '7', name: 'Craig', role: 'COMPUTER', score: 0, missed: 0, level: 70 },
//     {userid: '8', name: 'DeepBlue', role: 'COMPUTER', score: 0, missed: 0, level: 80 },
//     //{userid: '9', name: 'Hall', role: 'COMPUTER', score: 0, missed: 0, level: 90 },
//     {userid: '10', name: 'Master', role: 'COMPUTER', score: 0, missed: 0, level: 100 },
// ]