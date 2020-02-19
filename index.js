var path = require('path')

require('dotenv').config()

var axios = require('axios')

var express = require('express')
var app = express()

var server = require('http').createServer(app)
var io = require('socket.io')(server)

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

app.use(require('cookie-session')({
    secret: "qwerty"
}))
app.use(express.urlencoded({
    extended: true,
    verify: (req, res, buf) => {
        req.rawBody = buf
    }
}))
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf
    }
}))
app.use(express.static(path.join(__dirname, 'public')))

app.get('/', (req, res) => {
    if (req.session.token) {
        axios.get(`https://api.trello.com/1/members/me/boards?key=${process.env.trello_api_key}&token=${req.session.token}`).then(resp => {
            var boards = resp.data
            var organizations = {}

            Promise.all(boards.map(async item => {
                if (item.idOrganization && !organizations[item.idOrganization]) {
                    var resp = await axios.get(`https://api.trello.com/1/organizations/${item.idOrganization}?key=${process.env.trello_api_key}&token=${req.session.token}`)
                    item.organizationName = resp.data.displayName

                    organizations[item.idOrganization] = resp.data
                }
                else if (item.idOrganization) {
                    item.organizationName = organizations[item.idOrganization]
                }
                return item
            })).then(boardsWithOrganization => {
                res.render("loggedin", {
                    boards: boardsWithOrganization
                })
            })
        }).catch(err => {
            req.session = null
            res.render("index", {
                trello_api_key: process.env.trello_api_key
            })
        })
    }
    else {
        res.render("index", {
            trello_api_key: process.env.trello_api_key,
            return_url: process.env.return_url
        })
    }
})

app.post('/auth', (req, res) => {
    if (req.body.token) {
        axios.get(`https://api.trello.com/1/members/me/?key=${process.env.trello_api_key}&token=${req.body.token}`).then(resp => {
            req.session.token = req.body.token
            res.send()
        }).catch(err => {
            res.status(400).send()
        })
    }
    else {
        res.status(400).send()
    }
})

app.get('/display', (req, res) => {
    if (req.session.token && req.query.board) {

        axios.get(`https://api.trello.com/1/boards/${req.query.board}/?key=${process.env.trello_api_key}&token=${req.session.token}`).then(resp => {
            res.render('display', {
                board: {
                    name: resp.data.name,
                    id: resp.data.id
                },
                ignore: req.query.ignore
            })

            axios.post(`https://api.trello.com/1/webhooks?idModel=${req.query.board}&callbackURL=${process.env.webhook_url}&key=${process.env.trello_api_key}&token=${req.session.token}&description=Trello%20Display`).then(resp => {
                console.log("Success")
            }).catch(err => {
                // Webhook already exists, and that's OK
            })
        }).catch(err => {
            res.redirect('/')
        })
    }
    else {
        res.redirect('/')
    }
})

app.post('/display', (req, res) => {
    if (req.session.token && req.query.board) {
        axios.get(`https://api.trello.com/1/boards/${req.query.board}/?key=${process.env.trello_api_key}&token=${req.session.token}&lists=open&cards=visible`).then(resp => {
            if(!req.query.ignore || req.query.ignore == ""){
                res.json(resp.data)
            }
            else{
                var data = resp.data
                var ignore = req.query.ignore.split(",")

                resp.data.lists = resp.data.lists.filter(item => {
                    return !ignore.map(item2 => item2.toLowerCase()).includes(item.name.toLowerCase())
                })

                res.json(resp.data)
            }
        }).catch(err => {
            res.status(400).send()
        })
    }
    else {
        res.status(400).send()
    }
})

app.get('/logout', (req, res) => {
    req.session = null
    res.redirect('/')
})

app.head('/trelloWebhook', (req, res) => {
    res.send()
})

app.post('/trelloWebhook', require('./verifyTrelloWebhook'))
app.post('/trelloWebhook', (req, res) => {
    res.send()

    io.in(req.body.model.id).emit("update")
})

io.on("connection", (socket) => {
    socket.join(socket.handshake.query.board)
})

server.listen(process.env.PORT || 8080, () => {
    console.log("App started.")
})