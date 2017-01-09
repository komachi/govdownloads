import request from 'request-promise';
import cidrRange from 'cidr-range';
import cheerio from 'cheerio';
import randomUa from 'random-ua';
import Promise from 'bluebird';
import _ from 'lodash';
import fs from 'fs-extra';
import config from './ru_ips.json';

process.env.UV_THREADPOOL_SIZE = 10;

const ranges = _.mapValues(config, (val, key) => {
  return  _.flatten(val.map(cidr => cidrRange(cidr)));
});

function getDownloadsForIP(ip) {
  console.log(`Getting downloads for ${ip}`);
  return request({
    url: `https://iknowwhatyoudownload.com/ru/peer/?ip=${ip}`,
    transform(body) {
      return cheerio.load(body);
    },
    headers: {
      'User-Agent': randomUa.generate()
    }
  }).then($ => {
    const result = [];
    $('tbody tr').each(function(i, elem) {
      result.push({
        begin: $(this).find('.date-column').first().text().trim(),
        end: $(this).find('.date-column').last().text().trim(),
        category: $(this).find('.category-column').text().trim(),
        title: $(this).find('.name-column').text().trim(),
        link: `https://iknowwhatyoudownload.com${$(this).find('.name-column a').attr('href').trim()}`,
        size: $(this).find('.size-column').text().trim(),
        ip
      });
    });
    return result;
  });
}

const promises = _.mapValues(ranges, ips => {
  return Promise.map(ips, ip => {
    return getDownloadsForIP(ip);
  }, {concurrency: 10}).then(result => {
    return _.flatten(result);
  });
});

Promise.props(promises).then(result => {
  return Promise.promisify(fs.outputJson)
    (`${__dirname}/_data/rugovdownloads.json`, {
      updated: new Date().toJSON(),
      data: result
    });
}).catch(console.log);
