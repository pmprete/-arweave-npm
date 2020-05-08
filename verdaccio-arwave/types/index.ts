import { Config } from '@verdaccio/types';

export interface CustomConfig extends Config {
  jwk: string;
  host: string | undefined;
  port: string | number | undefined;
  protcol: string | undefined;
}
