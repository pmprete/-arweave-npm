# Arweave Inmutable npm
 Arweave inmutable npm implementation for new york blockchain week hackaton.

I created a [Verdaccio](https://verdaccio.org/) storage plugin to publish and read npm packages frmo [Arweave](https://www.arweave.org/).

## How to run it
Move your jwk file to [./verdaccio-docker/config](./verdaccio-docker/config) and rename it as `arweave-keyfile.json`. This is important as this is the jwk that will be used to sign the transactions when publishing an npm package in arweave.

To set up the enviroment just run

```bash
bash run.sh
```

It will install the npm dependencies, build the docker image and run it. 
This will run a verdaccio docker image with the custom storage plugin for arweave. Once it finishes loading you can check it out on:

`http://localhost:4873/`

To publish a package, go to the folder of that package and run
```bash
npm publish --registry http://localhost:4873
```

Refresh the page and you should see your package :)


## Arquitecture
The plugin is divided in 3 parts:
- arweave-plugin-storage: It's in charge of the initialization and retriving all the packages and adds and removes package private packages (of course this can't be done in the arweave)
- arweave-package-manager: It creates and reads the package.json and tarball files.
- arweave-storage: Abstraction layer that uses arweave-js to comunicate with Arweave

We are using arql to search for the packages in arweave. Currently we use the tags
- ['Content-Type', 'application/json or application/octet-stream']
- ['App-Name','verdaccio-arweave'] 
- ['App-Version','0.0.1']
- ['Source','NPM'],
- ['Package-Name', 'the package Name']
- ['File-Name', 'package.json or the name of the tarball.tgz']

The package.json and the Tarball are readed and writed separetly
I use a in memory list of the packages as cache

The configuration needed for verdaccio is in [config.yaml](./verdaccio-docker/conf/config.yaml) under store arweave

```
store:
  arweave:
    jwk: /verdaccio/conf/arweave-keyfile.json # path to jwk used to publish packages
    host: arweave.net   # Hostname or IP address for a Arweave host
    #port: 433     # Port
    protcol: https    # Network protocol http or https
    #storageAddress: aNTVAabBqoXGoUjIO-qfgzzAts7Qxt9uTcO9W8n9efo    # Set this if you to retrieve all packages from this specific address
    timeout: 20000            # Network request timeouts in milliseconds
    logging: true         # Network loggingeen tested 
```

Besides storageAddress you can set up a specific address in the config.yaml inside packages.storage, this functionally has not been tested yet.

## Verification
I was performing the Verification of the transaction to validate that it wasn't tampered, see [arweave-storage.ts getTransaction(id)](./verdaccio-arweave/src/arweave-storage.ts)
But some times, when i called arweave.transactions.get(id), it retrieved a transaction with empty data. So i ended up using  arweave.transactions.getData(id) instead.

## Changes needed for PROD
In order to have this plugin ready for production it needs:
- A better cache that is stored also in disk.
- Arql needs to support from block and to block in order to avoid retrieving the entire list of packages all the time, also notEquals would be a nice to have.
- Better handling of private packages and secret
- Needs to get only authenticated accounts, currently if someone created the package with the corresponding tags it will be considered valid, it should use some tipe of authentication that matches with the address, for example using [arweave identity-provider](https://explorer.arweave.co/app/identity-link)
- Tarball should be sent directly as a stream instead of storing it in a buffer and the sending it
- Handle private packages correctly
- More tests
- Error Handling



