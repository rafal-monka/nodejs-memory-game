var AuthenticationClient = require('auth0').AuthenticationClient;

var auth0 = new AuthenticationClient({
    domain: process.env.AUTH0_DOMAIN,
    clientID: process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_CLIENT_SECRET
});

exports.getUserProfile = (token, callbackf) => {
    //const accessToken = token//req.headers.authorization.split(' ')[1]; // should be present & safe because auth0 middleware already validated auth token.
    // https://auth0.github.io/node-auth0/module-auth.AuthenticationClient.html#getProfile  
// console.log('###auth.getUserProfile.token')
    auth0.getProfile(token, (err, userInfo) => {
        // console.log('###auth.getUserProfile.userInfo',userInfo)
        if (err) {
            console.log('###Handle next(). Error=', err)
            //---###throw new Error(err)
            //Too Many Requests
        }
        // if (!userProfile.email_verified) {
        //   return res.status(400).send({message: 'Email must be verified before proceeding'});
        // }      
        callbackf(userInfo)
    })
} 
