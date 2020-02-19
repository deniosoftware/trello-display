var crypto = require('crypto')

module.exports = (req, res, next) => {
    var computedHash = crypto.createHmac('sha1', process.env.webhook_secret).update(req.rawBody + process.env.webhook_url).digest()
    var trelloHash = req.headers['x-trello-webhook'];

    if(crypto.timingSafeEqual(computedHash, Buffer.from(trelloHash, "base64"))){
        next()
    }
    else{
        res.status(403).send("Trello webhook not validated.")
    }
}