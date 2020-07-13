require('dotenv').config()
const express = require("express");
const cors = require('cors')
const bodyParser = require("body-parser");
const jwt = require("express-jwt");
const jwksRsa = require("jwks-rsa");

const initDatabase = require('./config/database')
const wss = require('./wss')
const auth = require('./auth')
const Game = require('./app/models/game-model') //temp for testing -> /play
const app = express();

const PlayMemoryGame = require('./app/controllers/play-memory-game')

app.use(cors())
app.use(bodyParser.json());                                     
app.use(bodyParser.urlencoded({extended: true}));               
app.use(bodyParser.text());                                    
app.use(bodyParser.json({ type: 'application/json'})); 

//Auth0 configuration
const authConfig = {
  domain: "ang-auth.eu.auth0.com",
  audience: "https://ang-auth.eu.auth0.com/api/v2/"
};

//Middleware that validates incoming bearer tokens using JWKS from YOUR_DOMAIN
//@@@AUTH0
const checkJwt = jwt({
    secret: jwksRsa.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${authConfig.domain}/.well-known/jwks.json`
    }),
    audience: authConfig.audience,
    issuer: `https://${authConfig.domain}/`,
    algorithms: ["RS256"]
});


app.get("/api/home", (req, res) => {
    res.json({ message: "Welcome to Memory Game API" });
});


// --------------------------------temp
app.get("/api/wssclients", (req, res) => {   
    let arr = wss.getWssClients()
    res.json({
        clients: arr.map(item => item.clientInfo)
    } )    
})

// --------------------------------temp
app.get("/play/:gameid", (req, res) => {  
    console.log('/play/:gameid', req.params.gameid)
    Game.findOneAndUpdate({gameid: req.params.gameid}, {status: 'STARTED'}, {new: true})
        .then(function (result) { 
            let playMemoryGame = new PlayMemoryGame(result, res)
            playMemoryGame.playGame()           
        })
})

//Endpoints that must be called with an access token
//@@@AUTH0
if (true) app.use(checkJwt, (req, res, next) => {
    const token = req.headers.authorization.split(' ')[1];
    auth.getUserProfile(token, (arg) => {
        console.log(`server.getUserProfile=`+JSON.stringify(arg))
        req.userProfile = arg
        next()               
    })         
})
//@@@AUTH0
if (false) app.use((req, res, next) => {
    req.userProfile = {
        sub: 'google-oauth2|103332170467986196787',
        email: 'monka.rafal@gmail.com',
        name: 'Test user RM',
        email_verified: true
    }
    next()
})

//App API endpoints
app.use("/api", require('./app/routes/'))

//###temp/TO-DELETE
app.get("/api/external", (req, res) => {
    console.log('req.user', req.user)
    //console.log('req.session.userInfo', req.session.userInfo) 
    res.send({
        msg: new Date()+"Your Access Token was successfully validated!"
    });
});

//errors
app.use(function (err, req, res, next) {
    if (err.name === 'UnauthorizedError') {
        res.status(401).send('JWT Unauthorized access. Invalid token...');
    } else {
        res.status(404).json('ERROR! '+err.stack)
    }
});

// Start the app
//port
const port = process.env.PORT
var server = app.listen(port, () => {
    wss.init(server)
    console.log(`API listening on ${port}`)
});

//init database
initDatabase()

