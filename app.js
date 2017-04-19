require('dotenv').config()
var restify = require('restify')
var builder = require('botbuilder')
var azure = require('azure-storage');

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

// =========================================================
// Bots Dialogs
// =========================================================

 var day, time;
 var data = {};

bot.dialog('/',

    function (session) {
        session.send("Hello GOTO Conference!")
        session.beginDialog('/SelectDay');
    });


bot.dialog('/SelectDay', [
    function (session) {
        builder.Prompts.choice(session, " What day would you like to view the schedule for?", ["Monday", "Tuesday", "Wednesday"]); 
    },
    function (session, results) {
        if (results.response) {
            day = results.response
            session.beginDialog('/SelectTime') 
        } else {
           session.beginDialog('/SelectDay');
        }
    }
]);


bot.dialog('/SelectTime', [
    function (session) {
        builder.Prompts.choice(session, "What time slot?", ["1035","1140","1330"]); 
    },
    function (session, results) {
        if (results.response) {
            session.send('Pulling the sessions. One second')
            RetrieveSchedule(session, results.response.entity, function(session){
              // Card goes here!
              session.send("Here is the schedule: " + data.talk)
            })
           
        } else {
           session.beginDialog('/SelectTime');
        }
    }
]);



function RetrieveSchedule (session, response, onQueryFinish, next) {
  var query = new azure.TableQuery()
    .top(1)
    .where('time eq ?', response)

  tableSvc.queryEntities('GoTo', query, null, function (error, result, response) {
    if (!error) {

      //Manipulate results into JSON object for card
      data.firstName = result.entries[0].firstName._;
      data.lastName = result.entries[0].lastName._;
      data.day = result.entries[0].day._;
      data.time = result.entries[0].time._;
      data.talk = result.entries[0].talk._;
      data.link = result.entries[0].link._;
      data.image = result.entries[0].image._;
      data.abstract = result.entries[0].abstract._;
      data.cofirstName = result.entries[0].cofirstName._;
      data.colastName = result.entries[0].colastName._;

      
      onQueryFinish(session)
    //  next()
    } else {
      console.log(error)
    }
  })
}