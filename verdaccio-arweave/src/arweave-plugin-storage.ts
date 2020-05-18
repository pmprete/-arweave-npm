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
  onValidatePackage,
  StorageList
} from '@verdaccio/types';
import { getInternalError, getServiceUnavailable, getConflict, getCode } from '@verdaccio/commons-api';

import { ArweaveConfig } from '../types/index';

import ArweavePackageManager from './arweave-package-manager';

import fs from 'fs';
import Arweave from 'arweave/node';
import ArweaveStorage from './arweave-storage';

export default class ArweavePluginStorage implements IPluginStorage<ArweaveConfig> {
  config: ArweaveConfig & Config;
  version?: string;
  arweaveStorage: ArweaveStorage;
  public logger: Logger;
  private jwk: string;
  public storageAddress?: string;

  public constructor(
    config: ArweaveConfig & Config,
    options: PluginOptions<ArweaveConfig>
  ) {
    this.config = config;
    this.logger = options.logger;

    this.jwk = '';
    if(this.config.jwk) {
      this.jwk = fs.readFileSync(this.config.jwk, 'utf8');
    }
    this.storageAddress = this.config.storageAddress;

    let arweave = Arweave.init({
      host: this.config.host || 'arweave.net',
      port: this.config.port || 433,
      protocol: this.config.protocol || 'https',
      timeout: this.config.timeout || 20000,
      logging: this.config.logging || false,
    });
    this.arweaveStorage = new ArweaveStorage(arweave, this.jwk);
  }

  /**
   *
   */
  public async getSecret(): Promise<string> {
    return Promise.resolve(this.jwk);
  }

  public async setSecret(secret: string): Promise<any> {
    return new Promise((resolve): void => {
      this.jwk = secret;
      resolve(null);
    });
  }

  /**
   * Add a new element.
   * @param {*} name
   * @return {Error|*}
   */
  public add(name: string, cb: Callback): void {
    this.logger.debug({ name },'arweave: [plugin add] @{name} init');
    this.arweaveStorage.getPackageTxByFileName(name, 'name', this.storageAddress)
    .then(async (names: string[]) => {
      this.logger.trace({ names }, 'arweave: [plugin add] look for names @{names}');
      if(names[0]) {
        this.logger.debug({ names }, 'arweave: [plugin add] already exists');
        cb(null);
        return;
      }
      this.logger.trace('arweave: [plugin add] create transaction init');
      const transaction = await this.arweaveStorage.createDataTransaction(name, name, 'name');
      this.logger.trace({ transaction }, 'arweave: [plugin add] transaction @{transaction}');
      const result = await this.arweaveStorage.sendTransaction(transaction);
      if(result.status != 200) {
        this.logger.error({result},'arweave: [plugin add] send transaction error @{result}');
        cb(getCode(result.status, result.statusText));
        return;
      }
      cb(null);
    })
    .catch((err) => {
      this.logger.error('arweave: [plugin add] internal error');
      cb(getInternalError(err.message));
    });
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
    this.logger.warn('arweave: [plugin search] method has not been implemented yet');

    onEnd(getServiceUnavailable('search not implemented yet'));
  }

  /**
   * Remove an element from the database.
   * @param {*} name
   * @return {Error|*}
   */
  public remove(name: string, cb: Callback): void {
    this.logger.warn({ name }, 'arweave: [plugin remove] has been disabled @{name}');

    cb(getServiceUnavailable("remove method is disabled on arweave. Your can't remove packages from the permaweb"));
  }

  /**
   * Return all database elements.
   * @return {Array}
   */
  public get(cb: Callback): void {
    this.logger.debug('arweave: [plugin get] init');
    this.arweaveStorage.getAllPackages(this.storageAddress)
    .then((names: string[]) => {
      this.logger.trace({ names }, 'arweave: [plugin get] names @{names}');
      cb(null, names);
    })
    .catch((err) => {
      this.logger.error('arweave: [plugin get] internal error');
      cb(getInternalError(err.message));
    });
  }

  /**
   * Create an instance of the `PackageStorage`
   * @param packageName
   */
  public getPackageStorage(packageName: string): IPackageStorage {
    const packageAccess = this.config.getMatchedPackagesSpec(packageName);

    let packageAddress = packageAccess ? packageAccess.storage : undefined;
    if(!packageAddress) {
      packageAddress = this.storageAddress;
    }
    return new ArweavePackageManager(packageName, this.logger, this.arweaveStorage, packageAddress);
  }

  /**
   * All methods for npm token support
   * more info here https://github.com/verdaccio/verdaccio/pull/1427
   */

  public saveToken(token: Token): Promise<any> {
    this.logger.warn({ token }, 'arweave: [plugin saveToken] has not been implemented yet @{token}');

    return Promise.reject(getServiceUnavailable('save token method not implemented'));
  }

  public deleteToken(user: string, tokenKey: string): Promise<any> {
    this.logger.warn({ tokenKey, user }, 'arweave: [plugin deleteToken] has not been implemented yet @{user}');

    return Promise.reject(getServiceUnavailable('delete token method not implemented'));
  }

  public readTokens(filter: TokenFilter): Promise<Token[]> {
    this.logger.warn({ filter }, 'arweave: [plugin readTokens] has not been implemented yet @{filter}');

    return Promise.reject(getServiceUnavailable('read tokens method not implemented'));
  }

}
