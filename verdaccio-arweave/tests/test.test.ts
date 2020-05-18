import Arweave from 'arweave/node';
import fs from 'fs';
import { and, or, equals } from 'arql-ops';
import ArweaveStorage from '../src/arweave-storage';
import Transaction from 'arweave/node/lib/transaction';

test('should getAllPackages', async () => {
let arweave = Arweave.init({
    host: 'arweave.net',
    port: 433,
    protocol: 'https'
  });

  let jwk = fs.readFileSync('/Users/pedro/git/public/arweave-npm/verdaccio-docker/conf/arweave-keyfile.json', 'utf8');

  let myQuery = and(
    //equals('from', 'aNTVAabBqoXGoUjIO-qfgzzAts7Qxt9uTcO9W8n9efo'),
    equals('to', ''),
    equals('Source', 'NPM'),
    equals('File-Name', 'name'),
  );
  let result = await arweave.arql(myQuery)
  console.log(result);
  expect(result).toBeTruthy();

});