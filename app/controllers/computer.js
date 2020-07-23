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

    //Look for pairs in memory (knownCards array)
    findPair() {
        let pairIndex = this.knownCards.findIndex(cards => cards.length === 2)
        let retVal = pairIndex !== -1
        if (retVal) {
            this.memoryGame.openCard(this.knownCards[pairIndex][0].row,this.knownCards[pairIndex][0].col)
            this.memoryGame.openCard(this.knownCards[pairIndex][1].row,this.knownCards[pairIndex][1].col)
        }
        return retVal
    }

    //Logic of computer move
    computerMove() {
        this.memory = [...Array(constants.CONST_SIZE)].map(e => Array(constants.CONST_SIZE).fill(null))
        let level = this.memoryGame.game.players[this.memoryGame.game.currentPlayerInx].level
        
        //1. Build/refresh memory state based on counts and probability level
        this._setSIZE.forEach(row => {
            this._setSIZE.forEach(col => {
                let card = this.memoryGame.game.board[row][col]
                if (card.value !== constants.CONST_TAKEN) {
                    if (card.count > 0) {
                        let probabilityLevel = card.count ===0 ? level: Math.min(100,level+Math.pow(2, card.count)*level/constants.CONST_DIVIDER)   //for details look into level_simulation.xlsx
                        let rnd = utils.randomInteger(0, 100)
                        this.memory[row][col] = (rnd <= probabilityLevel ? card.value : null)
                    }
                } else {
                    this.memory[row][col] = constants.CONST_TAKEN
                }
            })
        })
    
        //2. Build temporary arrays:
        // - known cards: 0 => [{r,c}, {r,c}]
        // - uknown cards: [ {r,c}, {r,c}, {r,c}, ...]
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
    
        //3. Final procedure - look for pairs in memory
        let val
        if (!this.findPair()) {
            //random card in unknown cards
            let rnd1UnknownIndex = Math.floor(Math.random()*this.unknownCards.length)
            let card1 = {row: this.unknownCards[rnd1UnknownIndex].row, col: this.unknownCards[rnd1UnknownIndex].col}

            val = this.memoryGame.game.board[card1.row][card1.col].value
            //add card to known array
            knownCardsTemp[val].push( card1 )
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
