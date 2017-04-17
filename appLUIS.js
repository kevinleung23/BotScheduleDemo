require('dotenv').config()
var restify = require('restify')
var builder = require('botbuilder')

// =========================================================
// Bot Setup
// =========================================================

// Setup Restify Server
var server = restify.createServer()
server.listen(process.env.port || process.env.PORT || 3978, function () {
  console.log('%s listening to %s', server.name, server.url)
})

// Create chat bot
var connector = new builder.ChatConnector({
  appId: process.env.APP_ID,
  appPassword: process.env.APP_PASS
})

var bot = new builder.UniversalBot(connector)
server.post('/api/messages', connector.listen())

// Setup LUIS connection
var model = 'https://api.projectoxford.ai/luis/v1/application?id=' + process.env.LUIS_ID + '&subscription-key=' + process.env.LUIS_KEY + '&verbose=true'
var recognizer = new builder.LuisRecognizer(model)
var dialog = new builder.IntentDialog({recognizers: [recognizer]})
bot.dialog('/', dialog)

// =========================================================
// LUIS Dialogs
// =========================================================

dialog.matches('Greeting', [
  function (session, results) {
    session.send('Hello GOTO Conference! Can I help find a session for you?')
  }
])

dialog.matches('SearchByDay', [
  function (session, results) {
    session.beginDialog('/SearchDay')
  }
])

dialog.matches('SearchByName', [
  function (session, results) {
    session.beginDialog('/SearchName')
  }
])

dialog.matches('SearchByTime', [
  function (session, results) {
    session.beginDialog('/SearchTime')
  }
])

dialog.matches('None', [
  function (session, results) {
    session.send('Sorry.. I did\'t understand that. Let me show you what I can do.')
    session.beginDialog('/MainMenu')
  }
])

// =========================================================
// Bots Dialogs
// =========================================================

bot.dialog('/MainMenu', [
  function (session, results) {
    builder.Prompts.choice(session, 'I can do any of these, pick one!', ['Search Sessions By Day', 'Search Sessions By Name', 'Search Sessions By Time'])
  },
  function (session, results) {
    switch (results.response.index) {
      case 0:
        // Initiate "Search By Day" dialog
        session.beginDialog('/SearchDay')
        break
      case 1:
        // Initiate "Search By Name" dialog
        session.beginDialog('/SearchName')
        break
      case 2:
        // Initiate "Search By Time" dialog
        session.beginDialog('/SearchTime')
        break
    }
  }
])

bot.dialog('/SearchDay', [
  function (session, results) {
    session.send('SEARCH BY DAY')
    session.endDialog()
  }
])

bot.dialog('/SearchName', [
  function (session, results) {
    session.send('SEARCH BY NAME')
    session.endDialog()
  }
])

bot.dialog('/SearchTime', [
  function (session, results) {
    session.send('SEARCH BY TIME')
    session.endDialog()
  }
])
