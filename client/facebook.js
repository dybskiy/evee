var facebook = (function () {
  var fbDateFormats = ["YYYY-MM-DDThh:mm:ssZZ", "YYYY-MM-DD", "YYYY-MM-DDThh:mm:ss"];
  var sessionKeys = {};

  var login = function (accessToken) {
    return Session.set("accessToken", accessToken);
  };

  var getAccessToken = function () {
    return Session.get("accessToken") || null;
  };

  var getUserName = function () {
    return Session.get("userName") || null;
  };

  var setUserName = function (userName) {
    Session.set("userName", userName);
  };

  var fetchAndStoreEvents = function () {
    var accessToken = getAccessToken();
    if (accessToken !== null) {
      var timestamp = moment().startOf("day").unix();
      var url = "https://graph.facebook.com/me?fields=name,friends.fields(events.since(" + timestamp + ").limit(25).fields(id,description,start_time,end_time,location,name,venue,picture.width(100).height(100).type(square)))";
      url += "&access_token=" + accessToken;
      Meteor.http.get(url, {timeout: 30000}, processEvents);
    }
  };

  var processEvents = function (error, result) {
    if (result.statusCode === 200) {
      var json = JSON.parse(result.content);
      setUserName(json.name);
      var events = jsonToEventList(json);
      sortByDate(events);
      var datesAndEvents = eventsToDatesAndEventsMap(events);
      storeDatesAndEvents(datesAndEvents);
    }
  };

  var jsonToEventList = function (json) {
    var eventsIds = {};
    var events = [];
    json.friends.data.forEach(function (friend) {
      if (friend.events) {
        friend.events.data.forEach(function (event) {
          if (!(eventsIds.hasOwnProperty(event.id))) {
            events.push(event);
            eventsIds[event.id] = true;
          }
        });
      }
    });
    return events;
  };

  var sortByDate = function (events) {
    events.sort(function (a, b) {
      return moment(a.start_time, fbDateFormats).valueOf() - moment(b.start_time, fbDateFormats).valueOf();
    });
  };

  var eventsToDatesAndEventsMap = function (events) {
    var datesAndEvents = {};
    events.forEach(function (event) {
      var dateKey = moment(event.start_time, fbDateFormats).format(selectedDate.keyFormat);
      datesAndEvents[dateKey] = datesAndEvents[dateKey] || [];
      datesAndEvents[dateKey].push(event);
    });
    return datesAndEvents;
  };

  var storeDatesAndEvents = function (datesAndEvents) {
    Session.set("datesAndEvents", datesAndEvents);
  };

  var getEventsByDate = function (dateKey) {
    try {
      return Session.get("datesAndEvents")[dateKey];
    } catch (e) {
      return null;
    }
  };

  var fetchAndStoreEventAttendees = function (id) {
    var accessToken = getAccessToken();
    var url = "https://graph.facebook.com/" + id + "?fields=attending.limit(1000).fields(name,gender,picture.width(50).height(50))";
    url += "&access_token=" + accessToken;
    Meteor.http.get(url, {timeout: 30000}, processAttendees);
  };

  var processAttendees = function (error, result) {
    if (result.statusCode === 200) {
      var json = JSON.parse(result.content);
      var attending = json.attending ? json.attending.data : [];
      storeEventAttendees(json.id, attending);
    }
  };

  var storeEventAttendees = function (id, attendeesList) {
    Session.set("attendees" + id, attendeesList);
    sessionKeys["attendees" + id] = true;
  };

  var getEventAttendees = function (id) {
    return Session.get("attendees" + id) || null;
  };

  var logout = function () {
    _.extend(sessionKeys, {"accessToken": true, "userName": true, "datesAndEvents": true});
    _.each(_.keys(sessionKeys), function (k) {
      Session.set(k, null);
    });
    sessionKeys = {};
  };

  Meteor.autorun(fetchAndStoreEvents);

  return {
    login: login,
    getAccessToken: getAccessToken,
    getUserName: getUserName,
    getEventsByDate: getEventsByDate,
    fetchAndStoreEventAttendees: fetchAndStoreEventAttendees,
    getEventAttendees: getEventAttendees,
    logout: logout
  };
}());
