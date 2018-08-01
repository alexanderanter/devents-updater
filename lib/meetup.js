const api = require('meetup-api');
const pino = require('pino')();
const Promise = require('bluebird');

/**
 * Sleep for milliseconds.
 *
 * @param  {number} ms
 *
 * @return {Promise}
 */
const sleep = (ms) => {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
};

/**
 * Find cities.
 *
 * @param  {number} category
 * @param  {string} country
 *
 * @return {Promise}
 */
const findCities = (category, country) => {
  return new Promise(resolve => {
    api().getCities({
      category: category,
      country: country,
      page: 200
    }, (err, data) => {
      if (err) {
        pino.error(err.message);
        resolve([]);
      } else {
        resolve(data.results.filter(city => {
          return city.member_count >= 10;
        }));
      }
    });
  });
};

/**
 * Create event title.
 *
 * @param  {object} event
 *
 * @return {string}
 */
const eventTitle = (event) => {
  if (event.name.indexOf(event.group.name) !== -1) {
    return event.name;
  }

  return event.name + ' - ' + event.group.name;
}

/**
 * Get open events from meetup.com for a city.
 *
 * @param  {object} config
 * @param  {object} city
 *
 * @return {Promise}
 */
const getOpenEvents = (config, city) => {
  const client = api({
    key: config.token
  });

  const exclude = (config.exclude || []).map(s => s.toLowerCase());

  return new Promise(resolve => {
    client.getOpenEvents({
      // city: city.city,
      // country: city.country,
      category: config.category,
      page: 200,
      text_format: 'plain'
    }, (err, data) => {
      if (err) {
        resolve([]);
        pino.error(err.message);
        return;
      }

      const events = data.results.map(event => {
        // Bail if event has passed.
        if (event.time < Date.now()) {
          return;
        }

        // Bail if no venue.
        if (typeof event.venue === 'undefined') {
          return;
        }

        // Bail if event country don't match.
        if (event.venue.country.toLowerCase() !== config.country.toLowerCase()) {
          return;
        }

        // Bail if group should be excluded.
        if (exclude.indexOf(event.group.urlname.toLowerCase()) !== -1) {
          return;
        }

        return {
          title: eventTitle(event),
          date: event.time,
          city: event.venue.city.replace(/\d+(\s|)\d+/, '').trim(), // remove numbers in city, ex: 111 22 stochkolm.
          link: event.event_url,
          description: event.description,
          free: typeof event.fee === 'undefined'
        };
      }).filter(event => {
        return typeof event === 'object';
      });

      pino.info('Found ' + events.length + ' events for ' + city.city);

      resolve(events);
    });
  });
};

/**
 * Find events from meetup.com.
 *
 * @param  {object} config
 *
 * @return {Promise}
 */
const getEvents = async (config) => {
  if (!config.category || !config.country || !config.token) {
    pino.error('Missing category, country or token value');
    return Promise.resolve([]);
  }

  const client = api({
    key: config.token
  })

  const exclude = (config.exclude || []).map(s => s.toLowerCase());

  // const cities = await findCities(config.category, config.country);

  // if (!cities.length) {
  //   return Promise.resolve([]);
  // }

  // pino.info('Found ' + cities.length + ' cities from meetup.com');

  let events = [];
  let offset = 1;

  return new Promise(async (resolve) => {
    const apiPromise = Promise.promisify(client.getOpenEvents, { context: client });

    try {
      data = await apiPromise({ text: 'cryptocurrency', page: 200, text_format: 'plain' });
    } catch(err) {
      pino.error(err.message);
      return Promise.resolve([]);
    }

    console.log(data);

    while (data.meta.next) {
      events.push(...data.results.map(async event => {
        // Bail if event has passed.
        if (event.time < Date.now()) {
          return;
        }

        // Bail if no venue.
        if (typeof event.venue === 'undefined') {
          return;
        }

        // Bail if event country don't match.
        // if (event.venue.country.toLowerCase() !== config.country.toLowerCase()) {
        //   return;
        // }

        // Bail if group should be excluded.
        if (exclude.indexOf(event.group.urlname.toLowerCase()) !== -1) {
          return;
        }

        const city = event.venue.city.replace(/\d+(\s|)\d+/, '').trim();

        if (!/[A-Z]/.test(city[0])) {
          return;
        }

        return {
          title: eventTitle(event),
          date: event.time,
          city, // remove numbers in city, ex: 111 22 stochkolm.
          link: event.event_url,
          description: event.description,
          free: typeof event.fee === 'undefined'
        };
      }).filter(event => {
        return typeof event === 'object';
      }));

      try {
        data = await apiPromise({ text: 'cryptocurrency', page: 200, text_format: 'plain', offset });
      } catch(err) {
        pino.error(err.message);
        return Promise.resolve([]);
      }

      offset = offset + 1;

      // const events2 = await getOpenEvents(config, city);

      // if (events2 instanceof Array) {
      //   events = events.concat(events2);
      // }

      // if (i + 1 === cities.length) {
      //   resolve(events);
      //   break;
      // } else {
      //   i++;
      // }
    }

    pino.info('Found ' + events.length + ' events for meetup.com');

    Promise.all(events).then(res => {
      resolve(res);
    });
  });
};

module.exports = getEvents;
