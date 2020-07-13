const Computer = require('./computer')
const utils = require('../utils')
const constants = require('./../../config/constants');
const wss = require('./../../wss')

module.exports = class PlayMemoryGame {
    //currentStep
    //currentPlayerInx
    //openCards = []
    //waiting = false
    //cardsLeft
  
    constructor(game, res) {
        this.game = game
        // this.game.players = [
        //     //{userid: '1', name: 'Aaa', role: 'HUMAN', score: 0, missed: 0},
        //     {userid: '0', name: 'Atari', role: 'COMPUTER', score: 0, missed: 0, level: 0 },
        //     //{userid: '1', name: 'Spectrum', role: 'COMPUTER', score: 0, missed: 0, level: 10 },
        //     //{userid: '2', name: 'Amiga', role: 'COMPUTER', score: 0, missed: 0, level: 20 },
        //     //{userid: '3', name: 'Win', role: 'COMPUTER', score: 0, missed: 0, level: 30},
        //     //{userid: '4', name: 'Linux', role: 'COMPUTER', score: 0, missed: 0, level: 40 },
        //     {userid: '5', name: 'Android', role: 'COMPUTER', score: 0, missed: 0, level: 50 },
        //     //{userid: '6', name: 'Power', role: 'COMPUTER', score: 0, missed: 0, level: 60 },
        //     //{userid: '7', name: 'Craig', role: 'COMPUTER', score: 0, missed: 0, level: 70 },
        //     //{userid: '8', name: 'DeepBlue', role: 'COMPUTER', score: 0, missed: 0, level: 80 },
        //     //{userid: '9', name: 'Hall', role: 'COMPUTER', score: 0, missed: 0, level: 90 },
        //     {userid: '10', name: 'Master', role: 'COMPUTER', score: 0, missed: 0, level: 100 },
        // ]
        this.res = res
        this.wss = wss
        this.computer = new Computer(this) 
    }

    
    sendWSEvent(event, value) {
        //console.log('wss', this.wss)
        this.wss.notifyAllPlayers(this.game.gameid, { 
            event: event,
            payload: value
        } )
    }

    openCard(r,c) {
        console.log('openCard (step, r, c)', this.game.currentStep, r, c)
        if (!this.game.waiting && this.game.board[r][c].value >= 0) {
            this.game.board[r][c].count++
            this.game.openCards[this.game.currentStep] = {
                row: r,
                col: c,
                value: this.game.board[r][c].value,
                count: this.game.board[r][c].count
            }
            this.game.board[r][c].value = constants.CONST_OPEN

            let retVal = this.game.openCards[this.game.currentStep].value            
            let curStep = this.game.currentStep

            if (curStep === 0) { 
                this.game.currentStep = 1
            } else {
                this.game.currentStep = 0
            }

            //@@@save into DB. then()
            this.sendWSEvent('OPENCARD', {
                currentStep: curStep,
                openCard: this.game.openCards[curStep]
            })

            if (curStep === 1) {
                //check results
                if (this.game.openCards[0].value === this.game.openCards[1].value ) {
                    //console.log('YES! Player takes two pictures')
                    this.takeCards( () => {
                        if (this.game.players[this.game.currentPlayerInx].role==='COMPUTER') {
                            this.computer.computerMove()
                        }
                    })
                } else {
                    //console.log('NO! Player misses')
                    this.putBackCards()
                }
            }

            return retVal
        } else {
            return null
        }
    }

    takeCards(callback) {
        console.log('Hit! takeCards')      
        this.game.players[this.game.currentPlayerInx].score += 2
        this.game.cardsLeft -= 2
        console.log('cardsLeft', this.game.cardsLeft)

        let endOfGame = this.game.cardsLeft === 0
        this.game.currentStep = 0
        setTimeout(()=>{

            this.sendWSEvent('TAKECARDS', {
                openCards: this.game.openCards,
                cardsLeft: this.game.cardsLeft
            })  

            this.game.board[this.game.openCards[0].row][this.game.openCards[0].col].value = constants.CONST_TAKEN
            this.game.board[this.game.openCards[1].row][this.game.openCards[1].col].value = constants.CONST_TAKEN
            this.game.openCards = []
            this.game.waiting = false
            if (endOfGame) {
                console.log('GAME OVER')
                this.sendWSEvent('GAMEOVER', {
                    stats: this.game.players
                })
                if (this.res !== null) this.res.status(200).json(this.game.players) //###only for testing TO-DELETE
            }
            if (!endOfGame) callback()
        }, constants.CONST_PAUSE_TIME)
    }

    putBackCards() {
        console.log('Missed. putBackCards')
        this.game.players[this.game.currentPlayerInx].missed += 2;
        this.game.currentStep = 0
    
        setTimeout(()=>{

            this.sendWSEvent('PUTBACKCARDS', {
                openCards: this.game.openCards
            })

            this.game.board[this.game.openCards[0].row][this.game.openCards[0].col].value = this.game.openCards[0].value
            this.game.board[this.game.openCards[1].row][this.game.openCards[1].col].value = this.game.openCards[1].value
            this.game.openCards = []
            this.game.waiting = false
            //next player
            if (this.game.currentPlayerInx < this.game.players.length-1) {
                this.game.currentPlayerInx++
            } else {
                this.game.currentPlayerInx = 0
            }
            
            console.log('Player', this.game.players[this.game.currentPlayerInx].name)
            this.sendWSEvent('NEXTPLAYER', {
                currentPlayerInx: this.game.currentPlayerInx,
                player: this.game.players[this.game.currentPlayerInx],
            })                
              
            if (this.game.players[this.game.currentPlayerInx].role==='COMPUTER') {
                this.computer.computerMove() //this.game.players[this.game.currentPlayerInx].userid
            }
        }, constants.CONST_PAUSE_TIME)
    }

    playGame() {
        console.log('playGame (this.game.board)', this.game.board)

        if (/*###!this.game.board || this.game.board === undefined ||*/ this.game.board.length === 0) {
            let _setSIZE = [...Array(constants.CONST_SIZE).keys()]
            let _setCARDS = [...Array(constants.CONST_SIZE*constants.CONST_SIZE/2).keys()]                  
            let cards = [..._setCARDS, ..._setCARDS]  
            this.game.board = [...Array(constants.CONST_SIZE)].map(e => Array(constants.CONST_SIZE).fill(0))
            this.game.cardsLeft = cards.length
            _setSIZE.forEach(row => {
                _setSIZE.forEach(col => {
                    let inx = utils.randomInteger(0, cards.length-1)
                    let val = cards.splice(inx, 1)[0]
                    this.game.board[row][col] = {value: val, count: 0}
                })
            })
            this.game.currentStep = 0
            this.game.currentPlayerInx = 0 
            //this.sendWSEvent('INITGAME', this.game.board) //###unused
            //@@@save into DB.then()
            this.resumeGame()        
        } else {
            this.resumeGame()        
        }
    }
    
    resumeGame() {
        console.log('resumeGame', this.game.players)
        //@@@save in DB then( )
        this.sendWSEvent('RESUME', this.game)
        if (this.game.players[this.game.currentPlayerInx].role==='COMPUTER') {
            this.computer.computerMove() //this.game.players[this.game.currentPlayerInx].userid
        }
    }
};