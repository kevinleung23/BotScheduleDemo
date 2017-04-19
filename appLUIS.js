require('dotenv').config()
var restify = require('restify')
var builder = require('botbuilder')
var azure = require('azure-storage')
var lodash = require('lodash')

// =========================================================
// Azure Table Setup
// =========================================================

var tableSvc = azure.createTableService('azurecredits', process.env.AZURE_STORAGE)

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

var data = {}

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
    // capitalize to query DB
    results.response = lodash.capitalize(results.response)
    results.type = 'day'
    // display card with data
    RetrieveSchedule(session, results, function (session) {
      // test if data is populated (results found)
      if (data.isSuccess) {
        // display card with data
        var msg = DisplayCardData(session)
        session.send(msg)
      } else {
        session.send('Sorry.. no results matched your search. Please try again!')
      }
      session.endDialog()
    })
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
    // capitalize to query DB
    results.response = lodash.capitalize(results.response)
    if ((results.response === 'Kevin') || (results.response === 'Hao') || (results.response === 'David')) {
      results.type = 'firstName'
    } else {
      results.type = 'cofirstName'
    }
    // display card with data
    RetrieveSchedule(session, results, function (session) {
      // test if data is populated (results found)
      if (data.isSuccess) {
        // display card with data
        var msg = DisplayCardData(session)
        session.send(msg)
      } else {
        session.send('Sorry.. no results matched your search. Please try again!')
      }
      session.endDialog()
    })
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
    results.type = 'time'
    // display card with data
    RetrieveSchedule(session, results, function (session) {
      // test if data is populated (results found)
      if (data.isSuccess) {
        // display card with data
        var msg = DisplayCardData(session)
        session.send(msg)
      } else {
        session.send('Sorry.. no results matched your search. Please try again!')
      }
      session.endDialog()
    })
  }
])

// =========================================================
// Helper Functions - Query Azure Table
// =========================================================

function RetrieveSchedule (session, response, onQueryFinish, next) {
  var query = new azure.TableQuery()
    .top(1)
    .where(response.type + ' eq ?', response.response)

  tableSvc.queryEntities('GoTo', query, null, function (error, result, response) {
    if ((!error) && (result.entries[0])) {
      data.isSuccess = true
      // Manipulate results into JSON object for card
      data.firstName = result.entries[0].firstName._
      data.lastName = result.entries[0].lastName._
      data.day = result.entries[0].day._
      data.time = result.entries[0].time._
      data.talk = result.entries[0].talk._
      data.link = result.entries[0].link._
      data.image = result.entries[0].image._
      data.abstract = result.entries[0].abstract._
      data.cofirstName = result.entries[0].cofirstName._
      data.colastName = result.entries[0].colastName._

      onQueryFinish(session)
    //  next()
    } else {
      data.isSuccess = false
      console.log(error)
      onQueryFinish(session)
    }
  })
}

function DisplayCardData (session) {
  // display card with data
  var msg = new builder.Message(session)
    .textFormat(builder.TextFormat.xml)
    .attachments([
      new builder.ThumbnailCard(session)
            .title(data.talk)
            .subtitle(data.firstName + ' ' + data.lastName + ' & ' + data.cofirstName + ' ' + data.colastName + ' | ' + data.day + ' at ' + data.time)
            .text(data.abstract)
            .images([builder.CardImage.create(session, data.image)])
            .tap(builder.CardAction.openUrl(session, data.link))
    ])
  return msg
}
