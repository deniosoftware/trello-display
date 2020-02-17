var path = require('path')

require('dotenv').config()

var axios = require('axios')

var session = require('express-session')
var SQLiteStore = require('connect-sqlite3')(session)

var express = require('express')
var app = express()

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

app.use(session({
    store: new SQLiteStore,
    secret: "qwerty",
    resave: false,
    saveUninitialized: false
}))
app.use(express.urlencoded({
    extended: true
}))
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

app.get('/', (req, res) => {
    if(req.session.token){
        axios.get(`https://api.trello.com/1/members/me/boards?key=${process.env.trello_api_key}&token=${req.session.token}`).then(resp => {
            var boards = resp.data
            var organizations = {}

            Promise.all(boards.map(async item => {
                if(item.idOrganization && !organizations[item.idOrganization]){
                    var resp = await axios.get(`https://api.trello.com/1/organizations/${item.idOrganization}?key=${process.env.trello_api_key}&token=${req.session.token}`)
                    item.organizationName = resp.data.displayName

                    organizations[item.idOrganization] = resp.data
                }
                else if(item.idOrganization){
                    item.organizationName = organizations[item.idOrganization]
                }
                return item
            })).then(boardsWithOrganization => {
                res.render("loggedin", {
                    boards: boardsWithOrganization
                })
            })
        }).catch(err => {
            req.session.destroy()
            res.render("index", {
                trello_api_key: process.env.trello_api_key,
                return_url: process.env.return_url
            })
        })
    }
    else{
        res.render("index", {
            trello_api_key: process.env.trello_api_key,
            return_url: process.env.return_url
        })
    }
})

app.get('/auth', (req, res) => {
    res.render("auth")
})

app.post('/auth', (req, res) => {
    if(req.body.token){
        axios.get(`https://api.trello.com/1/members/me/?key=${process.env.trello_api_key}&token=${req.body.token}`).then(resp => {
            req.session.token = req.body.token
            res.send()
        }).catch(err => {
            res.status(400).send()
        })
    }
    else{
        res.status(400).send()
    }
})

app.get('/display', (req, res) => {
    if(req.session.token && req.query.board){
        axios.get(`https://api.trello.com/1/boards/${req.query.board}/?key=${process.env.trello_api_key}&token=${req.session.token}&lists=open&cards=visible`).then(resp => {
            res.render('display', {board: resp.data})
        }).catch(err => {
            res.redirect('/')
        })
    }
    else{
        res.redirect('/')
    }
})

app.listen(process.env.PORT || 8080, () => {
    console.log("App started.")
})