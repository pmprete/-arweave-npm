import {
  Logger,
  Callback,
  IPluginStorage,
  PluginOptions,
  IPackageStorage,
  TokenFilter,
  Token,
  Config,
  onEndSearchPackage,
  onSearchPackage,
  onValidatePackage
} from '@verdaccio/types';
import { getInternalError, getServiceUnavailable } from '@verdaccio/commons-api';

import { CustomConfig } from '../types/index';

import PackageStorage from './PackageStorage';

import fs from 'fs';
import Arweave from 'arweave/node';
import JWKInterface from 'arweave/node';

export default class VerdaccioStoragePlugin implements IPluginStorage<CustomConfig> {
  config: CustomConfig & Config;
  version?: string;
  jwt: string;
  arweave: Arweave;
  public logger: Logger;

  public constructor(
    config: CustomConfig,
    options: PluginOptions<CustomConfig>
  ) {
    this.config = config;
    this.logger = options.logger;

    this.arweave = Arweave.init({
      host: this.config.host,
      port: this.config.port,
      protocol: this.config.protocol
    });

    this.jwt = fs.readFileSync(this.config.jwt,'utf8');
  }

  /**
   *
   */
  public async getSecret(): Promise<string> {
    return Promise.resolve(this.jwt);
  }

  public async setSecret(secret: string): Promise<any> {
    return new Promise((resolve): void => {
      this.jwt = secret;
      resolve(null);
    });
  }

  /**
   * Add a new element.
   * @param {*} name
   * @return {Error|*}
   */
  public add(name: string, callback: Callback): void {

  }

  /**
   * Perform a search in your registry
   * @param onPackage
   * @param onEnd
   * @param validateName
   */
  public search(
    onPackage: onSearchPackage,
    onEnd: onEndSearchPackage,
    validateName: onValidatePackage
  ): void {
    /**
     * Example of implementation:
     * try {
     *  someApi.getPackages((items) => {
     *   items.map(() => {
     *     if (validateName(item.name)) {
     *       onPackage(item);
     *     }
     *   });
     *  onEnd();
     * } catch(err) {
     *   onEnd(err);
     * }
     * });
     */
  }

  /**
   * Remove an element from the database.
   * @param {*} name
   * @return {Error|*}
   */
  public remove(name: string, callback: Callback): void {
    callback(getInternalError("Your can't remove packages from Arwave permaweb"));
  }

  /**
   * Return all database elements.
   * @return {Array}
   */
  public get(callback: Callback): void {
    /*
      Example of implementation
      database.getAll((allItems, err) => {
        callback(err, allItems);
      })
    */
  }

  /**
   * Create an instance of the `PackageStorage`
   * @param packageInfo
   */
  public getPackageStorage(packageInfo: string): IPackageStorage {
    return new PackageStorage(this.config, packageInfo, this.logger);
  }

  /**
   * All methods for npm token support
   * more info here https://github.com/verdaccio/verdaccio/pull/1427
   */

  public saveToken(token: Token): Promise<any> {
    this.logger.warn({ token }, 'save token has not been implemented yet @{token}');

    return Promise.reject(getServiceUnavailable('[saveToken] method not implemented'));
  }

  public deleteToken(user: string, tokenKey: string): Promise<any> {
    this.logger.warn({ tokenKey, user }, 'delete token has not been implemented yet @{user}');

    return Promise.reject(getServiceUnavailable('[deleteToken] method not implemented'));
  }

  public readTokens(filter: TokenFilter): Promise<Token[]> {
    this.logger.warn({ filter }, 'read tokens has not been implemented yet @{filter}');

    return Promise.reject(getServiceUnavailable('[readTokens] method not implemented'));
  }
}
