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
    session.beginDialog('/SearchDay', results)
  }
])

dialog.matches('SearchByName', [
  function (session, results) {
    session.beginDialog('/SearchName', results)
  }
])

dialog.matches('SearchByTime', [
  function (session, results) {
    session.beginDialog('/SearchTime', results)
  }
])

dialog.matches('MainMenu', [
  function (session, results) {
    session.beginDialog('/mainMenu', results)
  }
])

dialog.onDefault([
  function (session, results) {
    session.send('Sorry.. I did\'t understand that. Let me show you what I can do.')
    session.beginDialog('/mainMenu', results)
  }
])

// =========================================================
// Bots Dialogs
// =========================================================

// present the user with a main menu of choices they can select from
bot.dialog('/mainMenu', [
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

// either extract the LUIS entity or ask the user for a day to search -- display the results
bot.dialog('/SearchDay', [
  function (session, results, next) {
    // check if results.entities is undefiend
    if (typeof results !== 'undefined' && results.entities) {
      var day = builder.EntityRecognizer.findEntity(results.entities, 'day')
      if (!day) {
        builder.Prompts.text(session, 'What day would you like to search?')
      } else {
        next({ response: day.entity })
      }
    } else {
      // prompt the user for the text manually
      builder.Prompts.text(session, 'What day would you like to search?')
    }
  },
  function (session, results) {
    if (results.response) {
      session.send('Searching for %s\'s schedule. One moment.', results.response)
    }
    session.endDialog()
  }
])

// either extract the LUIS entity or ask the user for a name to search -- display the results
bot.dialog('/SearchName', [
  function (session, results, next) {
    if (typeof results !== 'undefined' && results.entities) {
      var name = builder.EntityRecognizer.findEntity(results.entities, 'firstName')
      if (!name) {
        builder.Prompts.text(session, 'What name would you like to search?')
      } else {
        next({ response: name.entity })
      }
    } else {
      // prompt the user for the text manually
      builder.Prompts.text(session, 'What name would you like to search?')
    }
  },
  function (session, results) {
    if (results.response) {
      session.send('Searching for %s in the schedule. One moment.', results.response)
    }
    session.endDialog()
  }
])

// either extract the LUIS entity or ask the user for a time to search -- display the results
bot.dialog('/SearchTime', [
  function (session, results, next) {
    if (typeof results !== 'undefined' && results.entities) {
      var time = builder.EntityRecognizer.findEntity(results.entities, 'time')
      if (!time) {
        builder.Prompts.text(session, 'What time would you like to search?')
      } else {
        next({ response: time.entity })
      }
    } else {
      // prompt the user for the text manually
      builder.Prompts.text(session, 'What time would you like to search?')
    }
  },
  function (session, results) {
    if (results.response) {
      session.send('Searching today\'s schedule for %s session. One moment.', results.response)
    }
    session.endDialog()
  }
])
