import EventEmitter from 'events';
import { Client } from 'node-ssdp';
import debug from 'debug';
import Yeelight from './Yeelight';
import YeelightStatus from './Yeelight';

const SocketRefresh = 300000;

/**
 * Create a new instance of the YeelightSearch class
 * and start searching for new Yeelights
 * once a Yeelight has been found it will create an Yeelight instance
 * and emits the 'found' event light the Yeelight instance as payload
 *
 * @extends EventEmitter
 */
class YeelightSearch extends EventEmitter {
  constructor() {
    super();

    this.yeelights = [];
    this.config = { refresh: SocketRefresh };
    this.log = debug(`YeelightSearch`);
    // Setting the sourcePort ensures multicast traffic is received
    this.client = new Client({ sourcePort: 1982, ssdpPort: 1982 });

    this.client.on('response', data => this.addLight(data));
    // Register devices that sends NOTIFY to multicast address too
    this.client.on('advertise-alive', data => this.addLight(data));

    this.client.search('wifi_bulb');
  }

  /**
   * adds a new light to the lights array
   */
  addLight(lightdata) {
    let yeelight = this.yeelights.find(item => item.getId() === lightdata.ID);
    if (!yeelight) {
      yeelight = new Yeelight(lightdata);
      this.yeelights.push(yeelight);
      this.emit('found', yeelight);
    } else {
      this.log(`Light id ${lightdata.ID} status: ${yeelight.status}`);

      if ( yeelight.status === YeelightStatus.OFFLINE) {
        // Reconnect to light
        this.log(`Light id ${lightdata.ID} comming up`);
        yeelight.status = YeelightStatus.SSDP;
        yeelight.reconnect(lightdata);
      } else {
        if ( (Date.now() - yeelight.lastKnown) > SocketRefresh ) {
          // Avoid double calling (SSDP messages repeats two or three times in a row)
          yeelight.lastKnown += 100;
          this.log(`Light id ${lightdata.ID} hasn't refreshed`);
          yeelight.getValues('power', 'bright', 'rgb', 'color_mode','ct');
        }
      }
    }
  }

  /**
   * returns a list of all found Yeelights
   * @returns {array.<Yeelight>} array with yeelight instances
   */
  getYeelights() {
    return this.yeelights;
  }

  /**
   * returns one Yeelight found by id
   * @param {string} id Yeelight Id
   * @returns {Yeelight} Yeelight instance
   */
  getYeelightById(id) {
    return this.yeelights.find(item => item.getId() === id);
  }

  /**
   * refresh lights sending a new m-search
   */
  refresh() {
    this.client.search('wifi_bulb');
  }
}

module.exports = YeelightSearch;
