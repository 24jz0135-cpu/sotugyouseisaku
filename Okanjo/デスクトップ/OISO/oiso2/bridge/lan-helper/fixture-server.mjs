import os from 'node:os';
import {start} from './server.mjs';
const app=await start({directory:process.argv[2],port:0,adminPort:0,discoveryPort:0,quiet:true});
const address=Object.values(os.networkInterfaces()).flat().find(a=>a.family==='IPv4'&&!a.internal&&/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address));
console.log(JSON.stringify({host:address?.address,port:app.publicServer.address().port,serverId:app.state.id,fingerprint:app.fingerprint,secret:app.createPairing().secret}));
