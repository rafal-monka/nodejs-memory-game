const utils = require('../utils')
const constants = require('./../../config/constants');

module.exports = class Computer {
    _setSIZE = [...Array(constants.CONST_SIZE).keys()]
    memory = [...Array(constants.CONST_SIZE)].map(e => Array(constants.CONST_SIZE).fill(null))
    knownCards = []
    unknownCards = []

    constructor(game) {
        this.memoryGame = game    
    }

    findPair() {
        //look for pairs
        let pairIndex = this.knownCards.findIndex(cards => cards.length === 2)
        let retVal = pairIndex !== -1
        if (retVal) {
            this.memoryGame.openCard(this.knownCards[pairIndex][0].row,this.knownCards[pairIndex][0].col)
            this.memoryGame.openCard(this.knownCards[pairIndex][1].row,this.knownCards[pairIndex][1].col)
        }
        return retVal
    }

    computerMove() {
        console.log('computerMove()', this.memoryGame.game.currentPlayerInx, this.memoryGame.game.players[this.memoryGame.game.currentPlayerInx].name)
        this.memory = [...Array(constants.CONST_SIZE)].map(e => Array(constants.CONST_SIZE).fill(null))
        let level = this.memoryGame.game.players[this.memoryGame.game.currentPlayerInx].level
        
        //1. build memory
        //refresh memory state based on level and counts
        this._setSIZE.forEach(row => {
            this._setSIZE.forEach(col => {
                let card = this.memoryGame.game.board[row][col]
                if ([constants.CONST_TAKEN/*, constants.CONST_OPEN*/].indexOf(card.value)===-1) {
                    if (card.count > 0) {
                        let probabilityLevel = card.count ===0 ? level: Math.min(100,level+Math.pow(2, card.count)*level/constants.CONST_DIVIDER)   //for details look into level_simulation.xlsx
                        let rnd = utils.randomInteger(0, 100)
                        this.memory[row][col] = rnd <= probabilityLevel ? card.value : null
                    }
                    } else {
                        switch (card.value) {
                            case constants.CONST_TAKEN:
                                this.memory[row][col] = constants.CONST_TAKEN
                                break
                            /*case constants.CONST_OPEN:
                                this.memory[row][col] = card.value
                                break*/
                        }
                    }
            })
        })
    
        //build temporary arrays
        //known cards: 0 => [{r,c}, {r,c}]
        //uknown cards: [ {r,c}, {r,c}, {r,c}, ...]
        let knownCardsTemp = [...Array(constants.CONST_SIZE*constants.CONST_SIZE/2)].map(e => Array())
        this.unknownCards = []
        this.memory.map( (rowArr, row) => {
            rowArr.map( (value, col) => {
                if (value !== constants.CONST_TAKEN) {
                    if (value !== null ) {
                        knownCardsTemp[value].push({row, col})
                    } else {
                        this.unknownCards.push({row, col})
                    }
                }
            })
        })
        this.knownCards = knownCardsTemp.filter(cards => cards.length > 0)
    
        //2. procedure
        //look for pairs in memory
        let v1, v2
        if (!this.findPair()) {
            //random card in unknown cards
            let rnd1UnknownIndex = Math.floor(Math.random()*this.unknownCards.length)
            let card1 = {row: this.unknownCards[rnd1UnknownIndex].row, col: this.unknownCards[rnd1UnknownIndex].col}

            v1 = this.memoryGame.game.board[card1.row][card1.col].value
            //add card to known array
            knownCardsTemp[v1].push( card1 )
            //remove card from unknown array
            this.unknownCards.splice(rnd1UnknownIndex, 1)
            this.knownCards = knownCardsTemp.filter(cards => cards.length > 0)
    
            //look for pairs in memory again
            if (!this.findPair()) {
                this.memoryGame.openCard(card1.row, card1.col)               
                let rnd2UnknownIndex = Math.floor(Math.random()*this.unknownCards.length)
                this.memoryGame.openCard(this.unknownCards[rnd2UnknownIndex].row, this.unknownCards[rnd2UnknownIndex].col)
            }
        }
    }
}

//----------------------------------------------temp
        // //check results
        // if (this.memoryGame.game.openCards[0].value === this.memoryGame.game.openCards[1].value ) {
        //     //console.log('YES! Computer takes two pictures')
        //     this.memoryGame.takeCards( () => {
        //         this.computerMove(this.memoryGame.game.currentPlayerInx)
        //     })
        // } else {
        //     //console.log('NO! Computer misses')
        //     this.memoryGame.putBackCards()
        // }