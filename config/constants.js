
require('dotenv').config()

const constants = {
    CONST_OPEN: -111,
    CONST_TAKEN: -999,
    CONST_WAITING_TIME: process.env.WAIT_SECONDS*1000,
    CONST_SIZE: 8,
    CONST_DIVIDER: 200
}

module.exports = Object.freeze(constants)