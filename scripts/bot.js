// Description:
//   Commands to run licode server health checks
//
// Commands:
//   hubot last build - Returns the status of the last build in GitHub
//   hubot build <commit> - Builds that commit in CircleCI
//   hubot create prerelease v<X> from <commit> - Create a prerelease with name vX from that commit.
//   hubot create release v<X> - Create a release using the latest prerelease for that version.

var http = require('http');
var request = require('../utils/async-request');

module.exports = (robot) => {
  robot.respond(/jambo?/i, (msg) => {
    msg.send('JAMBO!')
  });
  
  robot.respond(/last build/i, (msg) => {
    var url = 'https://circleci.com/api/v1.1/project/github/lynckia/licode?circle-token=' + process.env.circleCi_token;
      request({url:url, json:true}).then(function(body) {
        console.log('body', body);
        if (body && body.length > 0) {
          var build = body[0];
          console.log(build);
          msg.send('Last build is ' + build.status + ' in branch ' + build.branch);
        }
      }).catch(function(error) {
        msg.send("Error connecting to CircleCI");
      });
  });
  
  robot.respond(/build ?(.*)?/i, (msg) => {
    var commit = msg.match[1];
      var url = 'https://circleci.com/api/v1.1/project/github/lynckia/licode/tree/master?circle-token=' + process.env.circleCi_token;
      request({url:url, json:true, method: 'POST', form: {'build_parameters[CIRCLE_JOB]':'build','revision':commit}}).then(function(body) {
        if (body && body.length > 0) {
          var build = body[0];
          msg.send('Build started');
        }
      }).catch(function(error) {
        msg.send("Error connecting to CircleCI");
      });
  });
  
  var github = function(url, method) {
      console.log(url, method);
      return request({url:url, 
                    json:true, 
                    method:method,
                    headers: {
                      'User-Agent': 'licodeBot'
                    },
                    auth: {
                      user: process.env.githubUser,
                      pass: process.env.githubToken,
                      'sendImmediately': true
                    }});
    };

  var createRelease = function(msg, mode, name, commit='') {
      var url = 'https://circleci.com/api/v1.1/project/github/lynckia/licode/tree/master?circle-token=' + process.env.circleCi_token;
      request({url:url, json:true, method: 'POST', form: {'build_parameters[RELEASE_VERSION]':name,'build_parameters[CIRCLE_JOB]':mode,'revision':commit}}).then(function(body) {
        if (body) {
          var build_url = 'https://circleci.com/api/v1.1/project/github/lynckia/licode/' + body.build_num;
          var reply_with_attachments = 'CircleCI started to create the ' + mode + ' ' + name;
          
          if (!body.lifecycle || body.lifecycle === 'finished') {
            reply_with_attachments = 'CircleCI failed with status ' + body.status;
            if (body.message) {
              reply_with_attachments = 'CircleCI failed with message ' + body.message;
            }
            msg.send(reply_with_attachments);
            return;
          }
          msg.send(reply_with_attachments);
          
          var timer = setInterval(function() {
            console.log("Checking...");
            request({url:build_url + '?circle-token=' + process.env.circleCi_token, method:'GET', json:true}).then(function(body) {
              if (body.lifecycle === 'finished') {
                clearInterval(timer);
                var reply_with_attachments = 'CircleCI finished with status ' + body.status;
                if (body.status === 'success') {
                  reply_with_attachments = 'CircleCI finished ' + mode + ' ' + name;
                }
                msg.send(reply_with_attachments);
              }
            }).catch(function(error) {
              console.log('Could not access circleci', error);
              clearInterval(timer);
            });
          }, 5 * 1000);
          setTimeout(function() {
            clearInterval(timer);
          }, 15 * 60 * 1000);
        }
      }).catch(function(error) {
        console.log(error);
        msg.send("Error connecting to CircleCI");
      });
    }; 
  
  robot.respond(/create prerelease (v.*) from (.*)/i, (msg) => {
    var name = msg.match[1];
    var commit = msg.match[2];
    createRelease(msg, 'prerelease', name, commit);
  });
  
  robot.respond(/create release (v.*)/i, (msg) => {
    var name = msg.match[1];
    createRelease(msg, 'release', name);
  });
  
  robot.respond(/git log/i, (msg) => {
      var url = 'https://api.github.com/repos/lynckia/licode/commits';
      github(url, 'get').then(function(body) {
        var text = '';
        for (var commit of body) {
          text += '<' + commit.html_url + '|' + commit.sha.substr(0,7) + '> ' + commit.author.login + ' ' + commit.commit.message + '\n';
        }
        var reply_with_attachments = {
          'attachments': [
            {
              'title': 'Commits',
                  'text': text,
                  'fallback': text,
                  'color': '#7CD197'
            }
          ],
          };

        msg.send(reply_with_attachments);
      });
    });
}
