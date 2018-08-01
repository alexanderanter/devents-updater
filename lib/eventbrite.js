const eventbrite = require('node-eventbrite');
const pino = require('pino')();
const Promise = require('bluebird');

/**
 * Create title.
 *
 * @param  {object} event
 *
 * @return {string}
 */
const createTitle = (event) => {
  const title = event.name.text.split('[')[0].trim();
  return title.length ? title : event.name.text;
};

/**
 * Get venue from eventbrite.com.
 *
 * @param  {object} api
 * @param  {number} id
 *
 * @return {Promise}
 */
const getVenue = (api, id) => {
  return new Promise(resolve => {
    api.get('venues', id, [], [], function (err, data) {
      if (err) {
        pino.error(err.message);
        resolve({});
        return;
      }

      resolve(data);
    });
  });
};

/**
 * Get events from eventbrite.com.
 *
 * @param  {object} config
 *
 * @return {Promise}
 */
const getEvents = (config) => {
  let api;

  try {
    api = eventbrite({
      token: config.token,
      version: 'v3'
    });
  } catch (err) {
    pino.error(err.message);
    return Promise.resolve([]);
  }

  return new Promise(async (resolve) => {
    const apiPromise = Promise.promisify(api.search, { context: api });
    const events = [];
    let page = 1;
    let data;

    try {
      data = await apiPromise({ q: 'cryptocurrency' });
    } catch(err) {
      pino.error(err.message);
      return Promise.resolve([]);
    }

    while(data.pagination.has_more_items) {
      events.push(...data.events.map(async event => {
        if (Date.parse(event.start.local) < Date.now()) {
          return;
        }
  
        // // Bail if event country don't match.
        // if (event.start.timezone.toLowerCase().indexOf(config.timezone.toLowerCase()) === -1) {
        //   return;
        // }
  
        const venue = await getVenue(api, event.venue_id);
  
        // Bail if no venue.
        if (typeof venue.address === 'undefined') {
          return;
        }
  
        // Bail if bad city name and if region is not a string.
        if (typeof venue.address.city !== 'string') {
          if (typeof venue.address.region !== 'string') {
            return;
          }
  
          venue.address.city = venue.address.region;

          // Bail if does not start with a capital letter
          if (!/[A-Z]/.test(venue.address.city[0])) {
            return;
          }
        }
  
        // Bail if bad name.
        if (typeof event.name !== 'object' || typeof event.name.text !== 'string') {
          return;
        }
  
        return {
          title: createTitle(event),
          date: Date.parse(event.start.local),
          city: venue.address.city.split(',')[0], // Only city name needed.
          link: event.url,
          description: event.description.text, // Use text instead of html since it's so much html tags.
          free: event.is_free
        };
      }).filter(event => {
        return typeof event === 'object';
      }));

      try {
        data = await apiPromise({ q: 'cryptocurrency', page });
      } catch(err) {
        pino.error(err.message);
        return Promise.resolve([]);
      }

      page = page + 1;
    }

    pino.info('Found ' + events.length + ' events from eventbrite.com');

    Promise.all(events).then(res => {
      resolve(res);
    });
  });
};

module.exports = getEvents;
