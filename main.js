
'use strict';


const utils =    require(__dirname + '/lib/utils'); // Get common adapter utils

const adapter = new utils.Adapter('primelab');

const querystring = require('querystring');
const http = require('https');
const zlib = require('zlib');

const jsdom = require('jsdom');
const { JSDOM } = jsdom;



// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
    try {
        adapter.log.info('cleaned everything up...');
        callback();
    } catch (e) {
        callback();
    }
});



// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {
    main();
});

let cookie;

function main() {
    login((data) => {
        adapter.log.info('Erfolgreich angemeldet');
        cookie = data;
        getAccountID(data, (err, accountLink)=>{
            getData(cookie, accountLink);
        });
    });
}


function login(callback){
    let post_data = querystring.stringify({'usrname': adapter.config.username, 'passwd': adapter.config.password});
    //adapter.log.info('Query String: ' + post_data);
    let options = {host: 'primelab.cloud', port: 443, path: '/index.php?id=3', method: 'POST', headers: {'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8', 'Accept-Encoding': 'gzip, deflate, br', 'Accept-Langugage': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7', 'Connection': 'keep-alive',  'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(post_data), 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.87 Safari/537.36'}};

    let post_req = http.request(options, (res) => {
        adapter.log.debug('Login cookie: ' + res.headers['set-cookie']);
        adapter.log.debug('Status Code Login: ' + res.headers.location);
        res.setEncoding('utf8');

        let cookie = res.headers['set-cookie'];

        callback(cookie);

        res.on('data', (chunk) => {
            adapter.log.debug('Response: ' + chunk);
        });
        res.on('end', (chunk) => {
            adapter.log.debug('On End: ' + chunk);
            // print to console when response ends
        });
    });

    post_req.write(post_data);
    post_req.end();

}

function getAccountID(cookie, callback){
    cookie = cookie.toString().split(";");
    adapter.log.debug('Get Account Cookie: ' + cookie[0]);

    let options = {host: 'primelab.cloud', port: 443, path: '/index.php?id=2', method: 'GET', headers: {'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8', 'Accept-Encoding': 'gzip, deflate, br', 'Accept-Langugage': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7', 'Connection': 'keep-alive', 'Cookie': cookie[0], 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.87 Safari/537.36'}};

    const gunzip = zlib.createGunzip();

    let compressed = (options, callback)=> {
        let get = http.get(options);
        let buffer = [];

        get.on('response', (res) => {
            if (res.statusCode !== 200) throw new Error('Status not 200');
            res.pipe(gunzip);

            gunzip.on('data', (data) => {
                buffer.push(data.toString());
            }).on("end", () => {
                // response and decompression complete, join the buffer and return
                callback(null, buffer.join(""));

            }).on("error", (e) => {
                callback(e);
            })
        }).on('error', (e) => {
            callback(e)
        });


        get.on('error', (err) => {
            throw err;
        })
    };

    compressed(options, (err, data)=>{
            adapter.log.debug('Data for getAccountID: ' + data);
        const dom = new JSDOM(data);
        let accountLink = dom.window.document.querySelector("#accountNavigation a").href;
        callback(null, accountLink);
    })
}

function getData(cookie, accountLink){
    adapter.log.debug('Account Link: ' + accountLink);
    cookie = cookie.toString().split(";");
    adapter.log.debug('Get Data Cookie: ' + cookie[0]);

    let options = {host: 'primelab.cloud', port: 443, path: `/${accountLink}`, method: 'GET', headers: {'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8', 'Accept-Encoding': 'gzip, deflate, br', 'Accept-Langugage': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7', 'Connection': 'keep-alive', 'Cookie': cookie[0], 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.87 Safari/537.36'}};

    const gunzip = zlib.createGunzip();

    let compressed = (options, callback)=> {
        let get = http.get(options);
        let buffer = [];

        get.on('response', (res) => {

            if (res.statusCode !== 200) throw new Error('Status not 200');
            res.pipe(gunzip);

            gunzip.on('data', (data) => {
                buffer.push(data.toString());
            }).on("end", () => {
                // response and decompression complete, join the buffer and return
                callback(null, buffer.join(""));

            }).on("error", (e) => {
                callback(e);
            })
        }).on('error', (e) => {
            callback(e)
        });


        get.on('error', (err) => {
            throw err;
        })
    };

    compressed(options, (err, data)=>{
        adapter.log.debug('Data for getData: ' + data);
        const dom = new JSDOM(data);

        //get number of all dataset's
        let nrOfData = dom.window.document.querySelector("tbody").childNodes.length /2;

        let cyanuric = false;
        let chlorineT = false;
        let chlorineF = false;
        let ph = false;


        for(let i = 0; i < nrOfData; i++) {
            let z = i +1;
            //get Data
            let set = dom.window.document.querySelector("tbody tr:nth-child("+z+")").textContent;
            set = set.split('\n');

            //Data to variable
            let userdate = set[2];
            let serial = set[4];
            let scenario = set[6];
            let parameter = set[7];
            let measurement = set[8];
            let unit = set[9];

            let sn = serial.replace(/-/g, '_');
            let id = scenario.replace(/-/g, '_');

            adapter.setObjectNotExists(sn, {
                type: 'device',
                common: {
                    name: serial,
                    role: 'sensor',
                    read: true,
                    write: false
                }
            });

            //generate Timestamp
            let t = new Date(userdate * 1000);
            let ts = t.toLocaleString();

            switch (scenario) {
                case '431-Cyanuric-Acid':
                    if(!cyanuric){
                        adapter.setObjectNotExists(`${sn}.${id}`, {
                            type: 'channel',
                            common: {
                                name: parameter,
                                read: true,
                                write: false
                            }
                        });
                        adapter.setObjectNotExists(`${sn}.${id}.measurement`, {
                            type: 'state',
                            common: {
                                name: 'Measurement of Cyanuric-Acid',
                                role: 'value',
                                type: 'number',
                                unit: unit,
                                read: true,
                                write: false
                            }
                        });
                        adapter.setObjectNotExists(`${sn}.${id}.timestamp`, {
                            type: 'state',
                            common: {
                                name: 'Timestamp for Cyanuric-Acid',
                                role: 'indicator.timestamp',
                                type: 'number',
                                read: true,
                                write: false
                            }
                        });

                        adapter.setState(`${sn}.${id}.measurement`, measurement, true);
                        adapter.setState(`${sn}.${id}.timestamp`, ts, true);

                        cyanuric = true;
                    }
                    break;
                case '421-Chlorine-Total':
                    if(!chlorineT){
                        adapter.setObjectNotExists(`${sn}.${id}`, {
                            type: 'channel',
                            common: {
                                name: parameter,
                                read: true,
                                write: false
                            }
                        });
                        adapter.setObjectNotExists(`${sn}.${id}.measurement`, {
                            type: 'state',
                            common: {
                                name: 'Measurement of Chlorine-Total',
                                role: 'value',
                                type: 'number',
                                unit: unit,
                                read: true,
                                write: false
                            }
                        });
                        adapter.setObjectNotExists(`${sn}.${id}.timestamp`, {
                            type: 'state',
                            common: {
                                name: 'Timestamp for Chlorine-Total',
                                role: 'indicator.timestamp',
                                type: 'number',
                                read: true,
                                write: false
                            }
                        });

                        adapter.setState(`${sn}.${id}.measurement`, measurement, true);
                        adapter.setState(`${sn}.${id}.timestamp`, ts, true);

                        chlorineT = true;
                    }
                    break;
                case '428-Chlorine-Free':
                    if(!chlorineF){
                        adapter.setObjectNotExists(`${sn}.${id}`, {
                            type: 'channel',
                            common: {
                                name: parameter,
                                read: true,
                                write: false
                            }
                        });
                        adapter.setObjectNotExists(`${sn}.${id}.measurement`, {
                            type: 'state',
                            common: {
                                name: 'Measurement of Chlorine-Free',
                                role: 'value',
                                type: 'number',
                                unit: unit,
                                read: true,
                                write: false
                            }
                        });
                        adapter.setObjectNotExists(`${sn}.${id}.timestamp`, {
                            type: 'state',
                            common: {
                                name: 'Timestamp for Chlorine-Free',
                                role: 'indicator.timestamp',
                                type: 'number',
                                read: true,
                                write: false
                            }
                        });

                        adapter.setState(`${sn}.${id}.measurement`, measurement, true);
                        adapter.setState(`${sn}.${id}.timestamp`, ts, true);

                        chlorineF = true;
                    }
                    break;
                case '429-pH-PoolLab':
                    if(!ph){
                        adapter.setObjectNotExists(`${sn}.${id}`, {
                            type: 'channel',
                            common: {
                                name: parameter,
                                read: true,
                                write: false
                            }
                        });
                        adapter.setObjectNotExists(`${sn}.${id}.measurement`, {
                            type: 'state',
                            common: {
                                name: 'Measurement of pH-PoolLab',
                                role: 'value',
                                type: 'number',
                                unit: unit,
                                read: true,
                                write: false
                            }
                        });
                        adapter.setObjectNotExists(`${sn}.${id}.timestamp`, {
                            type: 'state',
                            common: {
                                name: 'Timestamp for pH-PoolLab',
                                role: 'indicator.timestamp',
                                type: 'number',
                                read: true,
                                write: false
                            }
                        });

                        adapter.setState(`${sn}.${id}.measurement`, measurement, true);
                        adapter.setState(`${sn}.${id}.timestamp`, ts, true);

                        ph = true;
                    }
                    break;
            }
        }
    })
}

adapter.stop();