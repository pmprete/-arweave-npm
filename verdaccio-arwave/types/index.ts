import { Config } from '@verdaccio/types';

export interface ArweaveConfig extends Config {
  jwk?: string;               // jwk used to publish packages
  host?: string;              // Hostname or IP address for a Arweave host
  port?: string | number;     // Port
  protcol?: string;           // Network protocol http or https
  storageAddress?: string;    // Set this if you to retrieve all packages from this specific address
  timeout: number,            // Network request timeouts in milliseconds
  logging: boolean,           // Enable network request logging
}
